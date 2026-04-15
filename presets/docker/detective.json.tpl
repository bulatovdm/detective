{
  "adapter": "php",
  "app": {
    "url": "{{app_url}}"
  },
  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003,
      "ideKey": "{{ide_key}}"
    },
    "cli": {
      "exec": "docker exec {{container}} {command}"
    }
  },
  "pathMapping": {
    "{{container_path}}": "{{host_path}}"
  },
  "skipTlsVerification": true
}
