const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const uuidv4 = () => crypto.randomUUID();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadToS3 = async (file, folder) => {
  try {
    // Process image with Sharp
    const processedImage = await sharp(file.buffer)
      .resize(1080, 1080, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate unique filename
    const fileName = `${folder}/${uuidv4()}-${Date.now()}.jpg`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: processedImage,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    });

    await s3Client.send(command);

    // Return public URL
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload image');
  }
};

module.exports = { uploadToS3 };
