const fs = require('fs');
const path = require('path');

module.exports = {
  // Function to delete image from the storage:
  clearImage: (filepath) => {
    const filePath = path.join(__dirname, '..', filepath);
    fs.unlink(filePath, (err) => {
      console.log(err);
    });
  },
};
