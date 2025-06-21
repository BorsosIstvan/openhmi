<?php
header("Content-Type: application/json");

$json = file_get_contents("php://input");
$data = json_decode($json, true);
if (!$data || !isset($data['projectName'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Geen projectnaam opgegeven."]);
    exit;
}

$projectName = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['projectName']);
$projectDir = "../projects";
$filePath = "$projectDir/$projectName.json";

if (!is_dir($projectDir)) {
    if (!mkdir($projectDir, 0777, true)) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Kan projectmap niet aanmaken."]);
        exit;
    }
}

if (file_put_contents($filePath, $json)) {
    echo json_encode(["status" => "ok", "message" => "Project '$projectName' opgeslagen."]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Kan project niet opslaan."]);
}
