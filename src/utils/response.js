export const sendError = (res, statusCode, message, code = 'ERROR', sqlError = null) => {
    if (sqlError) console.error(`[SQL Error] ${sqlError.message}`);
    res.status(statusCode).json({ success: false, error: message, code });
};

export const sendSuccess = (res, data, message = null) => {
    res.status(200).json({ success: true, data, ...(message && { message }) });
};
