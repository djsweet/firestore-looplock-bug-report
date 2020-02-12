// Set your Firebase API Key and Project ID here
const firebaseConfig = {
  apiKey: "",
  projectId: ""
};

// This should be the same collection as in ../server/index.js.
const targetCollection = "firestore-loadlock-demo";

let latestUpdateStartTimestamp;
let latestUpdateStartTime;
let latestUpdateEndTime;
let documentCount = 0;
let expectedDocumentCount = 0;
const requestAnimationFramePeriods = [];
let lastRequestAnimationFrameTime;
let pollingRequestAnimationFrameTime = false;

function averageRequestAnimationFramePeriod() {
  const { length } = requestAnimationFramePeriods;
  if (length === 0) return 0;
  return Math.ceil(
    requestAnimationFramePeriods.reduce((left, right) => left + right, 0) /
      length
  );
}

function clearUpdatingField() {
  document.getElementById("ongoing-update-field").innerText = "No";
}

function updateTimesInPage() {
  if (
    latestUpdateStartTimestamp &&
    latestUpdateStartTime &&
    latestUpdateEndTime
  ) {
    clearUpdatingField();
    const resultTable = document.getElementById(`update-data-table`);
    const resultRow = document.createElement("tr");

    const timestampColumn = document.createElement("td");
    timestampColumn.innerText = latestUpdateStartTimestamp.toLocaleString();
    resultRow.appendChild(timestampColumn);

    const durationColumn = document.createElement("td");
    const difference = latestUpdateEndTime - latestUpdateStartTime;
    durationColumn.innerText = `${difference} ms`;
    resultRow.appendChild(durationColumn);

    const averageColumn = document.createElement("td");
    averageColumn.innerText = `${averageRequestAnimationFramePeriod()} ms`;
    resultRow.appendChild(averageColumn);

    const minColumn = document.createElement("td");
    minColumn.innerText = `${Math.min(...requestAnimationFramePeriods)} ms`;
    resultRow.appendChild(minColumn);

    const maxColumn = document.createElement("td");
    maxColumn.innerText = `${Math.max(...requestAnimationFramePeriods)} ms`;
    resultRow.appendChild(maxColumn);

    resultTable.appendChild(resultRow);
  }
}

function onRequestAnimationFrameDuringDatabaseOperations() {
  const now = window.performance.now();
  if (lastRequestAnimationFrameTime !== undefined) {
    requestAnimationFramePeriods.push(now - lastRequestAnimationFrameTime);
  }

  if (
    pollingRequestAnimationFrameTime ||
    requestAnimationFramePeriods.length < 2
  ) {
    lastRequestAnimationFrameTime = now;
    window.requestAnimationFrame(
      onRequestAnimationFrameDuringDatabaseOperations
    );
  } else {
    lastRequestAnimationFrameTime = undefined;
    updateTimesInPage();
  }
}

function enterAnimationFramePolling() {
  lastRequestAnimationFrameTime = undefined;
  pollingRequestAnimationFrameTime = true;
  requestAnimationFramePeriods.splice(0, requestAnimationFramePeriods.length);
  document.getElementById("ongoing-update-field").innerText = "Yes";
  window.requestAnimationFrame(onRequestAnimationFrameDuringDatabaseOperations);
}

function exitAnimationFramePolling() {
  pollingRequestAnimationFrameTime = false;
}

function setCurrentDocumentCount() {
  document.getElementById(
    "current-document-count-field"
  ).innerText = `${documentCount}`;
}

function setExpectedDocumentCount() {
  document.getElementById(
    "firestore-expected-update-count"
  ).innerText = `${expectedDocumentCount}`;
}

function setupListening() {
  firebase
    .firestore()
    .collection(targetCollection)
    .onSnapshot(snapshot => {
      const docs = snapshot.docChanges().map(change => change.doc);
      let firstOne = false;
      for (const doc of docs) {
        const data = doc.data();
        const updateTimestamp = data.updateTimestamp.toDate();

        if (
          latestUpdateStartTimestamp === undefined ||
          latestUpdateStartTimestamp.getTime() < updateTimestamp.getTime()
        ) {
          firstOne = true;
          latestUpdateStartTimestamp = updateTimestamp;
          latestUpdateStartTime = window.performance.now();
          documentCount = 0;

          setCurrentDocumentCount();
          enterAnimationFramePolling();
        }
      }

      documentCount += docs.length;
      setCurrentDocumentCount();
      if (documentCount >= expectedDocumentCount) {
        console.log(
          `${firstOne ? "total" : "end"}: ${docs.length}`,
          new Date()
        );
        latestUpdateEndTime = window.performance.now();
        exitAnimationFramePolling();
      } else {
        console.log(
          `${firstOne ? "begin" : "continue"}: ${docs.length}`,
          new Date()
        );
      }
    });
}

function firstRun() {
  return firebase
    .firestore()
    .collection(targetCollection)
    .get()
    .then(snapshot => {
      expectedDocumentCount = snapshot.size;
      setExpectedDocumentCount();
      clearUpdatingField();
    })
    .then(setupListening)
    .catch(console.error);
}

function main() {
  firebase.initializeApp(firebaseConfig);
  document.getElementById("firebase-sdk-field").innerText =
    firebase.SDK_VERSION;
  firstRun().catch(console.error);
}

window.onload = main;
