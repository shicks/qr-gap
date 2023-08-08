// NOTE: this runs in the browser

const barcodeDetector = new BarcodeDetector({formats: ['qr_code']});

// interface File {
//   filename: string
//   missing: Set<number>
//   chunks: Array<json>
//   li: ListItemElement
// }
const files = new Map/*<sha: string, File>*/();
const filesDiv = document.querySelector('#files');
const logDiv = document.querySelector('#log');

function newFile(json) {
  const li = document.createElement('li');
  const file = {
    missing: new Set(Array.from({length: json.n}, (_, i) => i)),
    chunks: [],
    li,
  };
  if (json.f) file.filename = json.f;
  li.dataset['sha'] = json.sha;
  filesDiv.appendChild(li);
  updateFile(file, json);
}
function updateFile(file, json) {
  if (json.f) file.filename = json.f;
  if (!file.missing.has(json.i)) return;
  file.missing.delete(json.i);
  file.chunks[json.i] = json;
  const name = file.filename || json.sha || 'no name?';
  if (file.missing.size) {
    file.li.textContent = `${name}: ${[...file.missing].join(' ')}`;
  } else {
    file.li.innerHTML = '';
    const a = document.createElement('a');
    const data = file.chunks.map(c => c.c || '').join('');
    a.href = `data:text/plain;base64,${btoa(data)}`;
    a.download = name;
    a.textContent = name;
    file.li.appendChild(a);
    // TODO - show bytes/sha?
  }
}

let decoding = false;
let localStream;
let interval;
const scannerContainer = document.querySelector(".scanner");
const home = document.querySelector(".home");
const startButton = document.querySelector("#startButton");
startButton.addEventListener('click', () => {
  scannerContainer.style.display = "";
  home.style.display = "none";
  loadDevicesAndPlay();
});

const closeButton = document.querySelector("#closeButton");
closeButton.addEventListener('click', () => {
  stop();
  scannerContainer.style.display = "none";
  home.style.display = "";
});

document.getElementsByClassName("camera")[0]
    .addEventListener('loadeddata', onPlayed, false);
document.getElementById("cameraSelect").addEventListener('change', onCameraChanged);

async function loadDevicesAndPlay(){
  const constraints = {video: true, audio: false};
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  localStream = stream;
  const cameraselect = document.getElementById("cameraSelect");
  cameraselect.innerHTML = "";
  const devices = await navigator.mediaDevices.enumerateDevices();
  let count = 0;
  const cameraDevices = [];
  let defaultIndex = 0;
  for (const device of devices) {
    if (device.kind === 'videoinput') {
      cameraDevices.push(device);
      const label = device.label || `Camera ${count++}`;
      cameraselect.add(new Option(label, device.deviceId));
      if (label.toLowerCase().indexOf("back") !== -1) {
        defaultIndex = cameraDevices.length - 1;
      }
    }
  }

  if (cameraDevices.length > 0) {
    cameraselect.selectedIndex = defaultIndex;
    await play(cameraDevices[defaultIndex].deviceId);
  } else {
    alert("No camera detected.");
  }
}

async function play(deviceId, HDUnsupported) {
  stop();
  let constraints = {};

  if (deviceId){
      constraints = {
          video: {deviceId: deviceId},
          audio: false,
      };
  } else {
      constraints = {
          video: true,
          audio: false,
      };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream = stream;
    const camera = document.getElementsByClassName("camera")[0];
    // Attach local stream to video element
    camera.srcObject = stream;
  } catch (err) {
    console.error('getUserMediaError', err, err.stack);
    alert(err.message);
  }
}

function stop() {
  clearInterval(interval);
  try {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
  } catch (e) {
    alert(e.message);
  }
}

function onCameraChanged() {
  var cameraselect = document.getElementById("cameraSelect");
  var deviceId = cameraselect.selectedOptions[0].value;
  play(deviceId);
}

function onPlayed() {
  updateSVGViewBoxBasedOnVideoSize();
  startDecoding();
}

function updateSVGViewBoxBasedOnVideoSize() {
  var camera = document.getElementsByClassName("camera")[0];
  var svg = document.getElementsByTagName("svg")[0];
  svg.setAttribute("viewBox",`0 0 ${camera.videoWidth} ${camera.videoHeight}`);
}

function startDecoding() {
  clearInterval(interval);
  //1000/25=40
  interval = setInterval(decode, 40);
}

async function decode() {
  if (!decoding) {
    console.log("decoding");
    var video = document.getElementsByClassName("camera")[0];
    decoding = true;
    var barcodes = await barcodeDetector.detect(video);
    decoding = false;
    console.log(barcodes);
    drawOverlay(barcodes);
  }
}

function drawOverlay(barcodes) {

  // TODO - rather than show the contents in the overlay, accumulate it in a
  // register and surface the download links.

  var svg = document.getElementsByTagName("svg")[0];
  svg.innerHTML = "";
  for (var i=0;i<barcodes.length;i++) {
    var barcode = barcodes[i];
    console.log(barcode);
    var lr = {};
    lr.x1 = barcode.cornerPoints[0].x;
    lr.x2 = barcode.cornerPoints[1].x;
    lr.x3 = barcode.cornerPoints[2].x;
    lr.x4 = barcode.cornerPoints[3].x;
    lr.y1 = barcode.cornerPoints[0].y;
    lr.y2 = barcode.cornerPoints[1].y;
    lr.y3 = barcode.cornerPoints[2].y;
    lr.y4 = barcode.cornerPoints[3].y;
    var points = getPointsData(lr);
    var polygon = document.createElementNS("http://www.w3.org/2000/svg","polygon");
    polygon.setAttribute("points",points);
    polygon.setAttribute("class","barcode-polygon");
    svg.append(polygon);

    try {
      const json = JSON.parse(barcode.rawValue);
      log.textContent = barcode.rawValue;
      let file = files.get(json.sha);
      if (file) {
        updateFile(file, json);
      } else {
        files.set(json.sha, file = newFile(json));
      }
    } catch (err) {
      // TODO - handle errors
    }
  }
}

function getPointsData(lr){
  var pointsData = lr.x1+","+lr.y1 + " ";
  pointsData = pointsData+ lr.x2+","+lr.y2 + " ";
  pointsData = pointsData+ lr.x3+","+lr.y3 + " ";
  pointsData = pointsData+ lr.x4+","+lr.y4;
  return pointsData;
}













// ////////////

// const barcodeDetector = new BarcodeDetector({formats: ['qr_code']});

// async function loadDevicesAndPlay() {
//   const constraints = {video: true, audio: false};
//   const localStream = await navigator.mediaDevices.getUserMedia(constraints);
//   const cameraselect = document.getElementById('cameraSelect');
//   cameraselect.innerHTML = '';
//   const devices = await navigator.mediaDevices.enumerateDevices();
//   let count = 0;
//   const cameraDevices = [];
//   let defaultIndex = 0;
//   for (const device of devices) {
//     if (device.kind === 'videoinput') {
//       cameraDevices.push(device);
//       const label = device.label || `Camera ${count++}`;
//       cameraselect.add(new Option(label, device.deviceId));
//       if (label.toLowerCase().indexOf("back") !== -1) {
//         //select the back camera as the default
//         defaultIndex = cameraDevices.length - 1;
//       }
//     }
//   }
//   if (cameraDevices.length > 0) {
//     cameraselect.selectedIndex = defaultIndex;
//     await play(cameraDevices[defaultIndex].deviceId);
//   } else {
//     alert('No camera detected.');
//   }
// }

// async function play(deviceId) {
//   stop(); // close before play
//   let constraints = {};

//   if (deviceId) {
//     constraints = {
//       video: {deviceId: deviceId},
//       audio: false,
//     };
//   } else {
//     constraints = {
//       video: true,
//       audio: false,
//     };
//   }

//   try {
//     const localStream = await navigator.mediaDevices.getUserMedia(constraints);
//     var cameraVideo = document.getElementsByClassName('camera')[0];
//     // Attach local stream to video element
//     cameraVideo.srcObject = stream;
//   } catch (err) {
//     console.error('getUserMediaError', err, err.stack);
//     alert(err.message);
//   }
// }

// function stop(){
//   try {
//     if (localStream) {
//       for (const track of localStream.getTracks()) {
//         track.stop();
//       }
//     }
//   } catch (e) {
//     alert(e.message);
//   }
// }
