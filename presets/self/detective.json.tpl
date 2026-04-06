{
  "adapter": "php",
  "app": {
    "url": "https://{{domain}}"
  },
  "php": {
    "xdebug": {
      "host": "0.0.0.0",
      "port": 9003,
      "ideKey": "IDE"
    },
    "cli": {
      "exec": "orb -m self -u {{user}} -s \"cd ~/sites/{{domain}}/self && {command}\""
    }
  }
}
