const process = require("process");
const admin = require("firebase-admin");
const pLimit = require("p-limit");

const firebaseConfig = {
  projectId: "" // Set your Firebase Project ID here
};

// Run `gcloud auth application-defaults login` and set the resulting file
// as GOOGLE_APPLICATION_CREDENTIALS in your environment.

// Be sure to run this at least once before opening the client HTML.

if (process.env["GOOGLE_APPLICATION_CREDENTIALS"] === undefined) {
  console.error(
    `You should set GOOGLE_APPLICATION_CREDENTIALS to a credential file for this to work`
  );
  return;
}

const numDocs = 3000;
const batchCount = 50;
const rightNow = admin.firestore.Timestamp.now();
const limit = pLimit(30);

// If you change this collection name, be sure to update it in ../client/index.js as well.
const targetCollection = "firestore-loadlock-demo";

admin.initializeApp(firebaseConfig);

async function main() {
  const firestore = admin.firestore();
  const startTime = process.hrtime.bigint();
  const promises = [];
  for (let i = 0; i < numDocs; i += batchCount) {
    const upperBound = i + batchCount;
    const collection = firestore.collection(targetCollection);

    promises.push(
      limit(() =>
        firestore.runTransaction(async txn => {
          for (let j = i; j < upperBound; j++) {
            txn.set(
              collection.doc(j.toString()),
              {
                updateTimestamp: rightNow
              },
              { merge: true }
            );
          }
        })
      )
    );
  }
  await Promise.all(promises);
  console.log(
    `Updated ${numDocs} documents in ${Number(
      process.hrtime.bigint() - startTime
    ) / 1000000} ms`
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
