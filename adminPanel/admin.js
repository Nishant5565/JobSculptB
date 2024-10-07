const express = require('express');
const router = express.Router();
const Skill = require('../models/skills');

// Add a new skill
router.post('/skills', async (req, res) => {
  const { skill } = req.body;

  try {
    let skillDoc = await Skill.findOne();
    if (!skillDoc) {
      skillDoc = new Skill({ skills: [] });
    }

    if (skillDoc.skills.some(s => s.skill === skill)) {
      return res.status(400).json({ msg: 'Skill already exists' });
    }

    skillDoc.skills.push({ skill });
    const savedSkill = await skillDoc.save();
    res.json({ savedSkill, msg: 'Skills added successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Bulk upload skills
router.post('/skills/bulk', async (req, res) => {
     const { skills } = req.body;
   
     try {
       let skillDoc = await Skill.findOne();
       if (!skillDoc) {
         skillDoc = new Skill({ skills: [] });
       }
       const validSkills = skills.filter((item) => item.Skill);
   
       const newSkills = validSkills.filter(
         (item) => !skillDoc.skills.some((s) => s.skill === item.Skill)
       );
   
       newSkills.forEach((item) => {
         skillDoc.skills.push({ skill: item.Skill });
       });
   
       const savedSkills = await skillDoc.save();
       res.json({ savedSkills, msg: 'Skills added successfully' });

     } catch (err) {
       console.error(err.message);
       res.status(500).send('Server Error');
     }
   });

// ! Get all the skills

router.get('/skills', async (req, res) => {
     try {
     const skillDoc = await Skill.findOne();
     if (!skillDoc) {
          return res.status(404).json({ msg: 'No skills found' });
     }
     res.json(skillDoc.skills);
     } catch (err) {
     console.error(err.message);
     res.status(500).send('Server Error');
     }
     });

// ! Delete a skill

router.delete('/skills/:name', async (req, res) => {
  const { name } = req.params;
  console.log(name);
  try {
    const skillDoc = await Skill.findOne();
    if (!skillDoc) {
      return res.status(404).json({ msg: 'No skills found' });
    }

    const removeIndex = skillDoc.skills.map((item) => item.skill).indexOf(name);
    if (removeIndex === -1) {
      return res.status(404).json({ msg: 'Skill not found' });
    }

    skillDoc.skills.splice(removeIndex, 1);
    await skillDoc.save();
    res.json({ msg: 'Skill removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
module.exports = router;