<?php
header("Content-Type: application/json");

if (!isset($_GET['project'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Geen projectnaam opgegeven."]);
    exit;
}

$projectName = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['project']);
$filePath = "../projects/$projectName.json";

if (!file_exists($filePath)) {
    http_response_code(404);
    echo json_encode(["status" => "error", "message" => "Project bestaat niet."]);
    exit;
}

echo file_get_contents($filePath);
