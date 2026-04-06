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
      "exec": "<replace with your CLI exec template, e.g.: orb -m self -u user -s \"cd ~/sites/app && {command}\">"
    }
  }
}
