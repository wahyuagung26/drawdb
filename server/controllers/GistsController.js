const GistsService = require('../services/GistsService');

class GistsController {
  /**
   * Create a new gist
   * POST /gists
   */
  static async create(req, res) {
    try {
      const { filename, description, content, public: isPublic } = req.body;

      // Validate required fields
      if (!filename || !content) {
        return res.status(400).json({
          success: false,
          error: 'filename and content are required'
        });
      }

      const gistId = await GistsService.create({
        filename,
        description: description || 'DrawDB diagram',
        content,
        public: isPublic || false
      });

      res.json({
        success: true,
        data: {
          id: gistId
        }
      });

    } catch (error) {
      console.error('Create gist error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create gist'
      });
    }
  }

  /**
   * Get gist by ID
   * GET /gists/:id
   */
  static async get(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Gist ID is required'
        });
      }

      const gist = await GistsService.get(id);

      // Try to parse content as JSON, if it fails keep as string
      let parsedContent;
      try {
        parsedContent = JSON.parse(gist.content);
      } catch (e) {
        parsedContent = gist.content;
      }

      // Return in GitHub Gists-compatible format
      res.json({
        id: gist.id,
        description: gist.description,
        public: gist.public,
        created_at: gist.createdAt,
        updated_at: gist.updatedAt,
        files: {
          [gist.filename]: {
            filename: gist.filename,
            type: "application/json",
            language: "JSON",
            raw_url: "", // Not needed for our use case
            size: gist.content.length,
            truncated: false,
            content: parsedContent
          }
        }
      });

    } catch (error) {
      console.error('Get gist error:', error);

      if (error.message === 'Gist not found') {
        return res.status(404).json({
          success: false,
          error: 'Gist not found'
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get gist'
      });
    }
  }

  /**
   * Update gist
   * PATCH /gists/:id
   */
  static async patch(req, res) {
    try {
      const { id } = req.params;
      const { filename, content } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Gist ID is required'
        });
      }

      const deleted = await GistsService.patch(id, { filename, content });

      res.json({
        success: true,
        deleted
      });

    } catch (error) {
      console.error('Patch gist error:', error);

      if (error.message === 'Gist not found') {
        return res.status(404).json({
          success: false,
          error: 'Gist not found'
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update gist'
      });
    }
  }

  /**
   * Delete gist
   * DELETE /gists/:id
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Gist ID is required'
        });
      }

      await GistsService.delete(id);

      res.json({
        success: true,
        message: 'Gist deleted successfully'
      });

    } catch (error) {
      console.error('Delete gist error:', error);

      if (error.message === 'Gist not found') {
        return res.status(404).json({
          success: false,
          error: 'Gist not found'
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete gist'
      });
    }
  }
}

module.exports = GistsController;