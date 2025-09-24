const express = require('express');
const GistsController = require('../controllers/GistsController');

const router = express.Router();

// POST /api/gists - Create new gist
router.post('/', GistsController.create);

// GET /api/gists/:id - Get gist by ID
router.get('/:id', GistsController.get);

// PATCH /api/gists/:id - Update gist
router.patch('/:id', GistsController.patch);

// DELETE /api/gists/:id - Delete gist
router.delete('/:id', GistsController.delete);

module.exports = router;