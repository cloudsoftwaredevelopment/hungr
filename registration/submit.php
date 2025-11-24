$servername = "localhost";
$username = "hungr";
$password = "Tura2020!";
$dbname = "hungr_seminar";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die(json_encode(["status" => "error", "message" => "Connection failed: " . $conn->connect_error]));
}

// Check if form data exists
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Sanitize inputs nicely
    $fullName = filter_var($_POST['fullName'], FILTER_SANITIZE_STRING);
    $email = filter_var($_POST['email'], FILTER_SANITIZE_EMAIL);
    $mobile = filter_var($_POST['mobile'], FILTER_SANITIZE_STRING);
    $restaurantName = filter_var($_POST['restaurantName'], FILTER_SANITIZE_STRING);

    // Basic validation
    if (empty($fullName) || empty($email) || empty($mobile) || empty($restaurantName)) {
        echo json_encode(["status" => "error", "message" => "All fields are required."]);
        exit;
    }

    // Prepare SQL statement (Prevents SQL Injection)
    $stmt = $conn->prepare("INSERT INTO merchant_registrations (full_name, email, mobile_number, restaurant_name) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $fullName, $email, $mobile, $restaurantName);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Error saving data: " . $stmt->error]);
    }

    $stmt->close();
} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}

$conn->close();
?>
