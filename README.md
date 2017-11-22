# word-game
## steps to setting up this web app

* login and set up a new project [here](https://console.firebase.google.com)
* in authorisation turn on Google
* in database turn on firestore stuff
* upgrade to pay as you go
* add rules:

### note:
#### storage rules
    service firebase.storage {
      match /b/{bucket}/o {
        // Files look like: "<UID>/path/to/file.txt"
        match /{userId}/{allPaths=**} {
          allow read, write: if request.auth.uid == userId;
        }
        match /{allPaths=**} {
          allow read;
        }
      }
    }
    
#### firestore rules
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read;
      allow write: if request.auth != null;
    } 
  }
}

* deploy
