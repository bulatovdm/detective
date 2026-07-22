{
  "adapter": "php",
  "app": {
    "url": "{{app_url}}"
  },
  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003,
      "ideKey": "detective"
    },
    "cli": {
      "exec": "docker exec -w /app {{container}} {command}"
    }
  },
  "pathMapping": {
    "/app": "{{host_path}}"
  },
  "skipTlsVerification": true
}
