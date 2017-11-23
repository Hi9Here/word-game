const functions = require('firebase-functions')
const admin = require("firebase-admin")

// Modules that get used in image resizing
const gcs = require('@google-cloud/storage')()
const spawn = require('child-process-promise').spawn
const path = require('path');
const os = require('os');
const fs = require('fs');
const vision = require('node-cloud-vision-api')

// Initialize the app
admin.initializeApp(functions.config().firebase);

// This is the datastore
const db = admin.firestore()
// NEW IMAGE RESIZER

'use strict';


// [START generateThumbnail]
/**
 * When an image is uploaded in the Storage bucket We generate a thumbnail automatically using
 * ImageMagick.
 */
// [START generateThumbnailTrigger]
const generateThumbnail = functions.storage.object().onChange(event => {
  // [END generateThumbnailTrigger]
  // [START eventAttributes]
  const object = event.data; // The Storage object.

  const fileBucket = object.bucket; // The Storage bucket that contains the file.
  const filePath = object.name; // File path in the bucket.
  const contentType = object.contentType; // File content type.
  const resourceState = object.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
  const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.
  // [END eventAttributes]

  // [START stopConditions]
  // Exit if this is triggered on a file that is not an image.
  if (!contentType.startsWith('image/')) {
    console.log('This is not an image.')
    return
  }

  // Get the file name.
  const fileName = path.basename(filePath);
  // Exit if the image is already a thumbnail.
  if (fileName.startsWith('thumb_')) {
    console.log('Already a Thumbnail.')
    return 1
  }

  // Exit if this is a move or deletion event.
  if (resourceState === 'not_exists') {
    console.log('This is a deletion event.')
    return 2
  }

  // Exit if file exists but is not new and is only being triggered
  // because of a metadata change.
  if (resourceState === 'exists' && metageneration > 1) {
    console.log('This is a metadata change event.')
    return 3
  }
  // [END stopConditions]

  // [START thumbnailGeneration]
  // Download file from bucket.
  const bucket = gcs.bucket(fileBucket)
  const tempFilePath = path.join(os.tmpdir(), fileName)
  return bucket.file(filePath).download({
    destination: tempFilePath
  }).then(() => {
    console.log('Image downloaded locally to', tempFilePath)
    // Generate a thumbnail using ImageMagick.
    return spawn('convert', [tempFilePath, '-thumbnail', '500x500>', tempFilePath])
  }).then(() => {
    console.log('Thumbnail created at', tempFilePath)
    // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
    const thumbFileName = `thumb_${fileName}`
    const thumbFilePath = path.join(path.dirname(filePath), thumbFileName)
    const uid = filePath.split("/")[0]
    const hash = filePath.split("/")[1]
    var theHash = {}
    theHash[hash] = true
    db.collection("Users").doc(uid).set({files: theHash}, {merge: true})
    db.collection("files").doc(hash).get().then(doc => {
      if (!doc.exists || (doc && doc.data() && !doc.data().vision)) {
        vision.init({auth: 'AIzaSyCKbNZem3UKzkWy8NST2Al7gKWpAXFduWU'})

        // construct parameters
        const reqV = new vision.Request({
          image: new vision.Image(tempFilePath),
          features: [
            new vision.Feature('FACE_DETECTION', 4),
            new vision.Feature('LABEL_DETECTION', 10),
            new vision.Feature('IMAGE_PROPERTIES', 10),
          ]
        })
        // send single request
        vision.annotate(reqV).then((resV) => {
          // handling response
          console.log(JSON.stringify(resV.responses))
          db.collection("files").doc(hash).set({vision: resV.responses}, {merge: true})
          theHash[uid] = 1
          db.collection("Users").doc(uid).set({files: theHash}, {merge: true})

        }, (e) => {
          console.log('Error: ', e)
        })
      } else {
        console.log('got it!', doc.data().vision)
      }

    }).then(() => {
      // Uploading the thumbnail.
      return bucket.upload(tempFilePath, { destination: thumbFilePath })
      
    }).then(() => fs.unlinkSync(tempFilePath)).catch((e) => console.log(e))
    // Once the thumbnail has been uploaded delete the local file to free up disk space.
  }).catch((e) => console.log(e))
  // [END thumbnailGeneration]
})
// [END generateThumbnail]
// END OF NEW IMAGE RESIZER

// // END OF IMAGE RESIZING FUNCTION
 module.exports = {
   generateThumbnail,
 }
