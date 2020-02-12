This is in service of [a bug report](https://github.com/firebase/firebase-js-sdk/issues/2620)
opened against the [Firebase JavaScript SDK](https://github.com/firebase/firebase-js-sdk).

## Background

We use [Cloud Firestore](https://cloud.google.com/firestore) to power [Glide](https://www.glideapps.com), which lets anyone create
amazing apps without writing a single line of code. Our data infrastructure uses the realtime update capabilities of Cloud Firestore
to supply these apps with their data, and sustains up to 3000 writes per second per app, in batches of 50 writes per transaction.
We recently needed to upgrade Firebase to the latest version (7.8.0 at the time of this experience), but discovered that the
performance of snapshot listeners severely regressed between 7.2.3 and 7.3.0.

We are seeing approximate update durations (from first update response to last update response) upwards of 30 seconds, some
completely stalling the event loop in the process. Our users with the most frequent updates have seen their browsers recommend
that they close their apps due to these stalls. Previously, all updates would take less than a second to capture, though they would
still block the event loop.

This project simulates our environment in the most minimal way possible. A simple "server" script upserts 3000 documents
into a collection that is listened to by a simple client, in batches of 50 updates per transaction. Each of these documents shares
a single timestamp for each update invocation. The client displays statistics about each round of updates, and assumes that every
document it knows about will be updated and that these documents share a common timestamp. (This client is merely functional and not
pretty. It was written quickly with minimal dependencies to demonstrate this problem.)

The target collection is called `firestore-loadlock-demo` by default. If you wish to change this, update both
[the server](https://github.com/djsweet/firestore-looplock-bug-report/blob/76d61748cd82c4bdc710362003f226755e523562/server/index.js#L27)
and
[the client](https://github.com/djsweet/firestore-looplock-bug-report/blob/76d61748cd82c4bdc710362003f226755e523562/client/index.js#L8)
to use the same collection name. For best results, there should be no other documents in this used collection. The client
does not use Firebase Auth, so the target collection should be world-readable in order to perform this demonstration. See
the documentation for [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started) for information
on how to configure Firestore to allow unauthenticated reads from this collection.

## Caveats

Due to the nature of the bug, it is not possible to determine the duration of the first `onSnapshot` response, or to include this
duration in the total duration per update session. Some output results will seem acceptable, or even decent. In these cases, the
brunt of the problem being experienced by the first invocation of the snapshot listener per update.

The optimistic statistics should not be trusted, and the pessimistic statistics should be assumed to be worse than reported.

## Prerequisites

You need to have a Firebase App with a Cloud Firestore instance in order to run this demonstration. Please consult the
[Firebase Documentation](https://firebase.google.com/docs/web/setup/)
for more information on how to create these instances if you do not already have them prepared.

You should also have the [`gcloud` Command Line Tool](https://cloud.google.com/sdk/gcloud)
installed. You will need it to obtain credentials to run the server script.

## Setup

### Step 1: Hard code the relevant credentials

Update
[the server](https://github.com/djsweet/firestore-looplock-bug-report/blob/76d61748cd82c4bdc710362003f226755e523562/server/index.js#L5)
with your Firebase Project ID, and
[the client](https://github.com/djsweet/firestore-looplock-bug-report/blob/76d61748cd82c4bdc710362003f226755e523562/client/index.js#L2)
with both your Firebase Project ID and your
Web API Key.

### Step 2: Install server dependencies

In `server/`, run `npm install`. This will give you the necessary dependencies to run this demonstration. Note that
the server dependencies should remain constant throughout the demonstration.

### Step 3: Acquire GCP Default Application Credentials

Run `gcloud auth application-default login` in an interactive shell and follow the prompts in your web browser. Once you
have followed the prompts in the browser, you will see a line in the interactive shell similar to this:

```
Credentials saved to file: [ ... ]
```

You will need to expose this file as an environment variable called `GOOGLE_APPLICATION_CREDENTIALS` for the server script.
Ensure that you always execute the server script with this environment variable set.

### Step 4: Prime the database

In order for the demonstration to execute correctly, all documents in the target collection must already exist. Running the
server script once before opening the client to ensures that they are created.

Simply run `node server/index.js` from the top-level directory of this repository to execute the server script.

## Testing

### Step 1: Open the client

Open `client/index.html` from the top-level directory of this repository in your web browser. You can do so without
involving a web server; all code can run directly from your local filesystem.

On first load, you will see a table entry in the client describing the Firebase SDK version, whether an update is ongoing,
the expected documents per update, and a current counter of the updated documents seen. Each series of statistics from
an update session is saved in a table; the first invocation of the snapshot listener will constitute the first row of the
table. Due to the characteristics of Firestore snapshot listeners, exactly one row will always be written when the client
is loaded.

You should wait for this initial row to appear before continuing to the next step.

### Step 2: Run the server scripts again

This invocation of the server script will simulate the characteristics of the snapshot listener with a realtime update.
Simply run `node server/index.js` from the top-level directory of this repository again.

### Step 3: Wait for the relevant report in the client

The client will write a new row with statistics for each real-time update session. The session has not completed until
a new row is added. Wait for the new row for each session to ensure the most accurate results.

### Step 4: Repeat from Step 6 for multiple measurements

There will be variability between update session invocation statistics. For the most accurate understanding of the problem,
run a few updates before continuing to the next step.

### Step 5: Change the Firebase SDK version and repeat

This project uses Firebase SDK 7.8.1 by default, but the problem began between 7.2.3 and 7.3.0. These versions, as well
as 7.8.0, are worth additional testing.
[Modify the client](https://github.com/djsweet/firestore-looplock-bug-report/blob/76d61748cd82c4bdc710362003f226755e523562/client/index.html#L38)
to use the alternative version and repeat from Testing Step 1, opening a new
client to ensure the correct Firebase SDK version.
