const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
dotenv.config();

// Configuration
cloudinary.config({ 
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key_cloud, 
    api_secret: process.env.api_secrect_cloud
});

// In the code above, we are importing the cloudinary module and configuring it using the cloudinary.config method. We are exporting the cloudinary object so that we can use it in other parts of our application.

// Step 3: Upload Images to Cloudinary


cloudinary.upload = async (file) => {
     try {
          const result = await cloudinary.uploader.upload(file, {
               resource_type: "image",
               overwrite: true,
               folder: "JobSculpt",
               public_id: `${Date.now()}`,
          });
          return result;
     } catch (error) {
          console.error(error);
     }
     }
// In the code above, we are defining a new method called upload that accepts a file as an argument. We are using the cloudinary.uploader.upload method to upload the file to Cloudinary. We are also passing the upload_preset option to specify the upload preset that we want to use.


     

// Step 4: Export the Cloudinary Module


module.exports = cloudinary;
