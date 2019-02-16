const express = require('express');
const router = express.Router();
const logic = require("../logic");

router.get('/', (req, res) => {
    res.render('index');
});

router.get('/add', (req, res) => {
    const url = req.query.url;
    const vanity = req.query.vanity;
    logic.addUrl(url, req, res, vanity);
});

router.get('/look', (req, res) => {
    const url = req.query.url;
    logic.whatIs(url, req, res);
});

router.get('/:segment', (req, res) => {
    logic.getUrl(req.params.segment, req, res);
});

module.exports = router;