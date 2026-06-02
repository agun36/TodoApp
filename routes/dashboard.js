var express = require('express');
var router = express.Router();

router.get("/", (req, res) => {
  res.render("dashboard", { title: "Dashboard" });
});

module.exports = router;