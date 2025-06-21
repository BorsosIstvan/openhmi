<?php
header("Content-Type: application/json");

$projectDir = "../projects";

// Controleer of de map bestaat
if (!is_dir($projectDir)) {
    echo json_encode([]);
    exit;
}

// Scan de map op .json-bestanden
$files = scandir($projectDir);
$projects = [];

foreach ($files as $file) {
    if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
        $projects[] = pathinfo($file, PATHINFO_FILENAME);
    }
}

echo json_encode($projects);
