
let uppercaseCookieName = "setUppercaseHex";
document.getElementById("uppercase_setting").checked = (window.localStorage.getItem("useUppercaseHex") === 'true');

const PID_NAMES = {
    0x0001: "DISC_UNIQUE_BRANCH",
    0x0002: "DISC_MUTE",
    0x0003: "DISC_UN_MUTE",
    0x0010: "PROXIED_DEVICES",
    0x0011: "PROXIED_DEVICE_COUNT",
    0x0015: "COMMS_STATUS",
    0x0020: "QUEUED_MESSAGE",
    0x0030: "STATUS_MESSAGES",
    0x0031: "STATUS_ID_DESCRIPTION",
    0x0032: "CLEAR_STATUS_ID",
    0x0033: "SUB_DEVICE_STATUS_REPORT_THRESHOLD",
    0x0050: "SUPPORTED_PARAMETERS",
    0x0051: "PARAMETER_DESCRIPTION",
    0x0060: "DEVICE_INFO",
    0x0070: "PRODUCT_DETAIL_ID_LIST",
    0x0080: "DEVICE_MODEL_DESCRIPTION",
    0x0081: "MANUFACTURER_LABEL",
    0x0082: "DEVICE_LABEL",
    0x0090: "FACTORY_DEFAULTS",
    0x00A0: "LANGUAGE_CAPABILITIES",
    0x00B0: "LANGUAGE",
    0x00C0: "SOFTWARE_VERSION_LABEL",
    0x00C1: "BOOT_SOFTWARE_VERSION_ID",
    0x00C2: "BOOT_SOFTWARE_VERSION_LABEL",
    0x00E0: "DMX_PERSONALITY",
    0x00E1: "DMX_PERSONALITY_DESCRIPTION",
    0x00F0: "DMX_START_ADDRESS",
    0x0120: "SLOT_INFO",
    0x0121: "SLOT_DESCRIPTION",
    0x0122: "DEFAULT_SLOT_VALUE",
    0x0200: "SENSOR_DEFINITION",
    0x0201: "SENSOR_VALUE",
    0x0202: "RECORD_SENSORS",
    0x0400: "DEVICE_HOURS",
    0x0401: "LAMP_HOURS",
    0x0402: "LAMP_STRIKES",
    0x0403: "LAMP_STATE",
    0x0404: "LAMP_ON_MODE",
    0x0405: "DEVICE_POWER_CYCLES",
    0x0500: "DISPLAY_INVERT",
    0x0501: "DISPLAY_LEVEL",
    0x0600: "PAN_INVERT",
    0x0601: "TILT_INVERT",
    0x0602: "PAN_TILT_SWAP",
    0x0603: "REAL_TIME_CLOCK",
    0x1000: "IDENTIFY_DEVICE",
    0x1001: "RESET_DEVICE",
    0x1010: "POWER_STATE",
    0x1020: "PERFORM_SELFTEST",
    0x1021: "SELF_TEST_DESCRIPTION",
    0x1030: "CAPTURE_PRESET",
    0x1031: "PRESET_PLAYBACK",
};

const CC_NAMES = {
    0x10: "DISCOVERY_COMMAND",
    0x11: "DISCOVERY_COMMAND_RESPONSE",
    0x20: "GET_COMMAND",
    0x21: "GET_RESPONSE",
    0x30: "SET_COMMAND",
    0x31: "SET_RESPONSE",
};

function normalizeHexInput(str) {
    if (!str) return "";
    return str.replace(/[^0-9a-fA-F]/g, "").trim();
}

function hexToBytes(str) {
    const hex = normalizeHexInput(str);
    if (hex.length === 0) return new Uint8Array();

    if (hex.length % 2 !== 0) {
        throw new Error("Hex string has an odd number of characters (cannot form full bytes).");
    }

    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

function createHexString(bytes, length){
    var useUppercaseHex = document.getElementById("uppercase_setting").checked;
    if(useUppercaseHex){
        return bytes.toString(16).toUpperCase().padStart(length, "0")
    } else {
        return bytes.toString(16).padStart(length, "0")
    }
    
}

function uidToString(bytes6) {
    // UID: 2-byte manufacturer ID + 4-byte device ID
    const manufacturerID = (bytes6[0] << 8) | bytes6[1];
    const deviceID = (bytes6[2] << 24) | (bytes6[3] << 16) | (bytes6[4] << 8) | bytes6[5];
    return `${createHexString(manufacturerID,4)}:${createHexString((deviceID >>> 0),8)}`;
}

function decodeRdmFrame(bytes) {
    if (bytes.length === 0) throw new Error("No bytes provided.");

    const results = {
        decoded: null
    };

    // Check start code
    const startCode = bytes[0]
    if (startCode == 0x00) throw new Error(`Start code 0x00 found - DMX frame decoding not yet supported.`); /* TODO DMX FRAME DECODING */
    else if (startCode == 0xFE) throw new Error(`Start code 0xFE found - Discovery response decoding not yet supported.`); /* TODO DISCOVERY FRAME DECODING */
    else if (startCode !== 0xCC) throw new Error(`Start code 0x${createHexString(bytes[0],2)} is not standard DMX/RDM.`);

    // Check message length field and compare with number of bytes received
    const messageLength = bytes[2];
    if (messageLength < 24) { // minimum defined by many E1.20 implementations as 24 (no parameter data)
        throw new Error(`Frame reported message length is ${messageLength} (< 24).`);
    }

    if (bytes.length < 3) throw new Error("Frame too short (need at least 2 bytes for start code and one slot).");
    else if (bytes.length < 24) {
        throw new Error("Frame is shorter than the minimum header (24 bytes) for a standard RDM packet layout.");
    }
    else if (bytes.length < messageLength + 2) {
        throw new Error(`According to the frame's message length, there should be a total of ${messageLength+2} bytes (including the checksum), but only ${bytes.length} bytes are present. `);
    }

    // Decode remaining parameters
    const destinationUID = bytes.slice(3, 9);
    const sourceUID = bytes.slice(9, 15);
    const transactionNumber = bytes[15];
    const portIDResponseType = bytes[16];
    const messageCount = bytes[17];
    const subDevice = (bytes[18] << 8) | bytes[19];

    // Decode MDB
    let commandClass = null, param = null, paramDataLength = null, paramData = new Uint8Array(0);
    if (bytes.length >= 24) {
        commandClass = bytes[20];
        param = (bytes[21] << 8) | bytes[22];
        paramDataLength = bytes[23];
        const pdStart = 24;
        const pdEnd = Math.min(bytes.length, pdStart + Math.max(0, paramDataLength));
        paramData = bytes.slice(pdStart, pdEnd);
    }

    // Decode and verify checksum
    let computedChecksum = null, receivedChecksum = null, checksumOK = null;
    computedChecksum = bytes.slice(0, messageLength).reduce((a, b) => (a + b) & 0xFFFF, 0);
    receivedChecksum = (bytes[messageLength] << 8) | bytes[messageLength + 1]; // big-endian
    checksumOK = (computedChecksum === receivedChecksum);
    if (computedChecksum != receivedChecksum) throw new Error(`Checksum mismatch: computed 0x${createHexString(computedChecksum,4)} vs received 0x${createHexString(receivedChecksum,4)}.`);
    
    // Collect results
    results.decoded = {
        framing: {
            startCode: `0x${createHexString(bytes[0],2)}`,
            subStartCode: `0x${createHexString(bytes[1],2)}`,
            messageLength: messageLength,
        },
        uids: {
            destination: uidToString(destinationUID),
            source: uidToString(sourceUID),
        },
        transaction: {
            transactionNumber: transactionNumber,
            portId_or_responseType: portIDResponseType,
            messageCount: messageCount,
        },
        subDevice: subDevice,
        messageDataBlock: {
            commandClass: commandClass !== null ? { value: `0x${createHexString(commandClass,2)}`, name: CC_NAMES[commandClass] || null } : null,
            pid: param !== null ? { value: `0x${createHexString(param,4)}`, name: PID_NAMES[param] || null } : null,
            parameterDataLength: paramDataLength,
            parameterData: {
                hex: Array.from(paramData).map(b => createHexString(b,2)).join(" "),
                ascii: new TextDecoder().decode(paramData)
            }
        },
        checksum: {
            computed: `0x${createHexString(computedChecksum,4)}`,
            received: `0x${createHexString(receivedChecksum,4)}`,
            ok: computedChecksum == receivedChecksum
        }
    };

    return results;
}

// UI
const $ = (id) => document.getElementById(id);
const statusElement = $("status");
const tableContainerElement = $("out");
const tableElement = $("fields");


function setStatus(text) {
    statusElement.textContent = text;
}

function renderResult(result) {
    tableElement.hidden = false;

    const d = result.decoded;
    const rows = [
        ["Start code", d.framing.startCode + (d.framing.startCode.toUpperCase()=== "0XCC" ? " (RDM)" : "")],
        ["Sub-start code", d.framing.subStartCode + (d.framing.subStartCode === "0x01" ? " (RDM)" : "")],
        ["Message length", `${d.framing.messageLength} (bytes, excluding checksum)`],
        ["Destination UID", d.uids.destination],
        ["Source UID", d.uids.source],
        ["Transaction number", d.transaction.transactionNumber],
        ["Port ID / Response type", d.transaction.portId_or_responseType],
        ["Message count", d.transaction.messageCount],
        ["Sub-device", `0x${createHexString(d.subDevice,4)}`],
        ["Command class", d.messageDataBlock.commandClass ? `${d.messageDataBlock.commandClass.value} ${d.messageDataBlock.commandClass.name ? "(" + d.messageDataBlock.commandClass.name + ")" : ""}` : "—"],
        ["Parameter ID", d.messageDataBlock.pid ? `${d.messageDataBlock.pid.value} ${d.messageDataBlock.pid.name ? "(" + d.messageDataBlock.pid.name + ")" : ""}` : "—"],
        ["Payload data length", d.messageDataBlock.parameterDataLength + " byte" + `${(d.messageDataBlock.parameterDataLength == 1) ? "" : "s"}`],
        ["Payload data (hex)", d.messageDataBlock.parameterData.hex || "—"],
        ["Payload data (ASCII)", d.messageDataBlock.parameterData.ascii || "—"],
        ["Checksum (computed)", d.checksum.computed],
        ["Checksum (received)", d.checksum.received],
        ["Checksum ok?", d.checksum.ok ? "YES" : "NO"]
    ];

    tableElement.innerHTML = "";
    for (const [k, v] of rows) {
        const tr = document.createElement("tr");
        const th = document.createElement("th"); th.textContent = k;
        const td = document.createElement("td"); td.textContent = v;
        tr.append(th, td);
        tableElement.appendChild(tr);
    }
}

function notifyCharInvalid(id){
    $(id).classList.add("numericEntryInvalid");
    setTimeout(clearCharInvalid.bind(null, id), 10);
}

function clearCharInvalid(id){
    $(id).classList.remove("numericEntryInvalid");
}

$("decodeBtn").onclick = () => {
    try {
        const bytes = hexToBytes($("hex").value);
        const result = decodeRdmFrame(bytes);
        setStatus("Decoded successfully.");
        renderResult(result);
    } catch (e) {
        setStatus(e.message || "Decode failed.");
        notifyCharInvalid("hex")
        tableElement.hidden = true;
    }
};

$("clearBtn").onclick = () => {
    $("hex").value = "";
    setStatus("Cleared.");
    tableElement.hidden = true;
};

$("sampleBtn").onclick = () => {
    $("hex").value = "cc012109c8a010000009c80100cdf91200000000210201090100ed00d600fa00fa08fe";
    $("decodeBtn").click();
    setStatus("Decoded sample frame.");
};

$("uppercase_setting").onchange = () => {
    $("decodeBtn").click();
}

const params = new URLSearchParams(window.location.search);
const data_param = params.get('data');  // "John"
if(data_param != null && data_param != ''){
    $("hex").value = data_param;
    $("decodeBtn").click();
} else {
    $("sampleBtn").click();
}
