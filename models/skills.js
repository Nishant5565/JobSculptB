const mongoose = require('mongoose');

const SkillSchema = new mongoose.Schema({
  skills: [
    {
      skill: {
        type: String,
        required: true,
        unique: true,
      },
    },
  ],
});

module.exports = mongoose.model('Skill', SkillSchema);