const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class GistsService {
  constructor() {
    this.storageDir = path.join(__dirname, '../storage/gists');
    this.ensureStorageDir();
  }

  async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Error creating storage directory:', error);
    }
  }

  /**
   * Create a new gist
   * @param {Object} data
   * @param {string} data.filename
   * @param {string} data.description
   * @param {string} data.content
   * @param {boolean} data.public
   * @returns {Promise<string>} Gist ID
   */
  async create(data) {
    const gistId = uuidv4();
    const gistData = {
      id: gistId,
      filename: data.filename,
      description: data.description,
      content: data.content,
      public: data.public || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const filePath = path.join(this.storageDir, `${gistId}.json`);
    await fs.writeFile(filePath, JSON.stringify(gistData, null, 2));

    return gistId;
  }

  /**
   * Get gist by ID
   * @param {string} gistId
   * @returns {Promise<Object>} Gist data
   */
  async get(gistId) {
    const filePath = path.join(this.storageDir, `${gistId}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Gist not found');
      }
      throw error;
    }
  }

  /**
   * Update gist content
   * @param {string} gistId
   * @param {Object} data
   * @param {string} data.filename
   * @param {string} data.content
   * @returns {Promise<boolean>} deleted status (always false for our use case)
   */
  async patch(gistId, data) {
    const gistData = await this.get(gistId);

    gistData.filename = data.filename || gistData.filename;
    gistData.content = data.content || gistData.content;
    gistData.updatedAt = new Date().toISOString();

    const filePath = path.join(this.storageDir, `${gistId}.json`);
    await fs.writeFile(filePath, JSON.stringify(gistData, null, 2));

    return false; // deleted status - always false for our implementation
  }

  /**
   * Delete gist
   * @param {string} gistId
   */
  async delete(gistId) {
    const filePath = path.join(this.storageDir, `${gistId}.json`);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Gist not found');
      }
      throw error;
    }
  }

  /**
   * Clean up old gists (call periodically)
   * Remove gists older than maxAge
   * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
   */
  async cleanup(maxAge = 24 * 60 * 60 * 1000) {
    try {
      const files = await fs.readdir(this.storageDir);
      const now = new Date();

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.storageDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const gist = JSON.parse(data);

          const createdAt = new Date(gist.createdAt);
          if (now - createdAt > maxAge) {
            await fs.unlink(filePath);
            console.log(`Cleaned up old gist: ${gist.id}`);
          }
        }
      }
    } catch (error) {
      console.error('Error during gists cleanup:', error);
    }
  }
}

module.exports = new GistsService();