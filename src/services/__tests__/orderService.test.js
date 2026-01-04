import { jest } from '@jest/globals';

// Mock dependencies BEFORE importing the service
jest.unstable_mockModule('../../config/db.js', () => ({
    db: {
        execute: jest.fn(),
        query: jest.fn()
    }
}));

jest.unstable_mockModule('../../utils/geo.js', () => ({
    haversineDistance: jest.fn(() => 5.0) // Return 5km distance by default
}));

jest.unstable_mockModule('../../routes/walletRoutes.js', () => ({
    processCustomerPayment: jest.fn(),
    getCustomerBalance: jest.fn()
}));

// Import modules dynamically after mocking
const { OrderService } = await import('../../services/orderService.js');
const { db } = await import('../../config/db.js');
const { getCustomerBalance, processCustomerPayment } = await import('../../routes/walletRoutes.js');

describe('OrderService', () => {
    let mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn()
        };
    });

    describe('createPabiliOrder', () => {
        it('should create a pabili order and notify riders', async () => {
            const userId = 1;
            const dto = {
                store_id: 10,
                items: [{ name: 'Item 1', quantity: 2 }],
                estimated_cost: 500,
                delivery_address: '123 Main St'
            };

            // Mock DB responses
            db.execute.mockResolvedValueOnce([{ insertId: 999 }]); // INSERT order
            db.execute.mockResolvedValueOnce([]); // INSERT items
            db.query.mockResolvedValueOnce([[{ id: 101, name: 'Rider 1' }, { id: 102, name: 'Rider 2' }]]); // SELECT riders

            const result = await OrderService.createPabiliOrder(userId, dto);

            expect(db.execute).toHaveBeenCalledTimes(2); // Order + 1 Item
            expect(result.orderId).toBe(999);
            expect(result.riders.length).toBe(2);
        });
    });

    describe('placeOrder - Food', () => {
        it('should place a food order successfully', async () => {
            const userId = 1;
            const dto = {
                restaurantId: 50,
                total: 200,
                paymentMethod: 'COD',
                items: [{ menu_item_id: 1, quantity: 1, price: 200 }]
            };
            const userDetails = { username: 'John', phone_number: '09123456789' };

            // Mock DB
            // 1. Restaurant Check (Available)
            db.execute.mockResolvedValueOnce([[{ is_available: 1 }]]);
            // 2. Address Check
            db.execute.mockResolvedValueOnce([[{ address: 'My Home' }]]);
            // 3. Insert Order
            db.execute.mockResolvedValueOnce([{ insertId: 888 }]);
            // 4. Insert Items
            db.execute.mockResolvedValueOnce([]);

            const result = await OrderService.placeOrder(userId, userDetails, dto, mockIo);

            expect(result.orderId).toBe(888);
            expect(mockIo.to).toHaveBeenCalledWith('merchant_50');
            expect(mockIo.emit).toHaveBeenCalledWith('new_order', expect.objectContaining({
                id: 888,
                status: 'pending',
                type: 'food'
            }));
        });

        it('should throw error if restaurant is offline', async () => {
            const userId = 1;
            const dto = { restaurantId: 50, total: 200, paymentMethod: 'COD' };
            const userDetails = {};

            // Restaurant Offline
            db.execute.mockResolvedValueOnce([[{ is_available: 0 }]]);

            await expect(OrderService.placeOrder(userId, userDetails, dto, mockIo))
                .rejects.toThrow('Restaurant is currently offline/closed.');
        });
    });

    describe('placeOrder - Store', () => {
        it('should place a store order and notify riders', async () => {
            const userId = 1;
            const dto = {
                storeId: 60,
                orderType: 'store',
                total: 300,
                paymentMethod: 'COD',
                items: [{ id: 1, name: 'Soap', quantity: 2, price: 50 }]
            };
            const userDetails = { username: 'Jane' };

            // Mock DB
            // 1. Address Check
            db.execute.mockResolvedValueOnce([[{ address: 'My Home' }]]);
            // 2. Insert Order
            db.execute.mockResolvedValueOnce([{ insertId: 777 }]);
            // 3. Insert Items (db.query for bulk insert)
            db.query.mockResolvedValueOnce([]);
            // 4. Get Store Loc
            db.execute.mockResolvedValueOnce([[{ latitude: 10, longitude: 122 }]]);
            // 5. Get Online Riders
            db.execute.mockResolvedValueOnce([[{ id: 201, latitude: 10.01, longitude: 122.01, name: "FastRider" }]]);

            const result = await OrderService.placeOrder(userId, userDetails, dto, mockIo);

            expect(result.orderId).toBe(777);
            expect(result.ridersNotified).toBe(1);
            expect(mockIo.to).toHaveBeenCalledWith('merchant_60');
        });
    });

    describe('placeOrder - Wallet Payment', () => {
        it('should throw INSUFFICIENT_FUNDS if balance is low', async () => {
            const userId = 1;
            const dto = {
                restaurantId: 50,
                total: 1000,
                paymentMethod: 'wallet',
                items: []
            };

            // Mock Balance Check
            getCustomerBalance.mockResolvedValueOnce(500); // Only 500 balance

            try {
                await OrderService.placeOrder(userId, {}, dto, mockIo);
            } catch (error) {
                expect(error.code).toBe('INSUFFICIENT_FUNDS');
                expect(error.message).toContain('Insufficient wallet balance');
            }
        });

        it('should process payment if balance is sufficient', async () => {
            const userId = 1;
            const dto = {
                restaurantId: 50,
                total: 200,
                paymentMethod: 'wallet',
                items: [{ menu_item_id: 1, quantity: 1 }]
            };

            // Mock Balance
            getCustomerBalance.mockResolvedValueOnce(1000);

            // Mock DB calls similar to Food Order...
            db.execute.mockResolvedValueOnce([[{ is_available: 1 }]]); // Rest Check
            db.execute.mockResolvedValueOnce([[{ address: 'Home' }]]); // Address
            db.execute.mockResolvedValueOnce([{ insertId: 555 }]); // Insert Order

            // Mock Payment
            processCustomerPayment.mockResolvedValueOnce({ transactionId: 'TXN123' });

            // Mock Items
            db.execute.mockResolvedValueOnce([]);

            await OrderService.placeOrder(userId, {}, dto, mockIo);

            expect(processCustomerPayment).toHaveBeenCalledWith(userId, 200, 555, 'wallet');
        });
    });
});
