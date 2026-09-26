import type { LanguageCode } from "@/lib/languages";

export type Copy = {
  chooseLanguage: string;
  changeLater: string;
  continue: string;
  howHelp: string;
  homeNav: string;
  tapMic: string;
  speakInBalti: string;
  requestDoctor: string;
  findFacility: string;
  myRequests: string;
  tapToSpeak: string;
  recording: string;
  speakNaturally: string;
  takeYourTime: string;
  tapToStop: string;
  allowMic: string;
  micNeeded: string;
  tapAllow: string;
  useMic: string;
  noMic: string;
  connectMic: string;
  tryAgain: string;
  recordingUnavailable: string;
  openBrowser: string;
  tooShort: string;
  speakLonger: string;
  recordAgain: string;
  silentTitle: string;
  silentBody: string;
  micFailed: string;
  backHome: string;
  understanding: string;
  usuallySeconds: string;
  stepSaved: string;
  stepListening: string;
  stepPreparing: string;
  cancel: string;
  couldNotUnderstand: string;
  tryOrRecord: string;
  couldNotHear: string;
  pleaseSpeakAgain: string;
  speakAgain: string;
  didWeUnderstand: string;
  wantDoctorLead: string;
  wantDoctorHeadline: string;
  wantFacilityLead: string;
  wantFacilityHeadline: string;
  understoodLead: string;
  language: string;
  spokenLanguage: string;
  request: string;
  howLong: string;
  doctorConsultation: string;
  facilityRequest: string;
  healthcareRequest: string;
  severalDays: string;
  notSpecified: string;
  safety: string;
  yesSend: string;
  sending: string;
  noSpeakAgain: string;
  couldNotSend: string;
  requestSent: string;
  providerWillReply: string;
  status: string;
  waiting: string;
  sent: string;
  viewRequests: string;
  newRequest: string;
  noRequests: string;
  backToRequests: string;
  requestMissing: string;
};

const english: Copy = {
  chooseLanguage: "Choose your language",
  changeLater: "You can change it later.",
  continue: "Continue",
  howHelp: "How can we help?",
  homeNav: "Home",
  tapMic: "Tap the microphone and tell us what you need.",
  speakInBalti: "Speak in Balti",
  requestDoctor: "Request a doctor",
  findFacility: "Find a healthcare facility",
  myRequests: "My requests",
  tapToSpeak: "Tap to speak",
  recording: "Recording",
  speakNaturally: "Speak naturally in Balti.",
  takeYourTime: "Take your time.",
  tapToStop: "Tap to stop",
  allowMic: "Allow the microphone to start.",
  micNeeded: "Microphone needed",
  tapAllow: "Tap below and choose Allow.",
  useMic: "Use microphone",
  noMic: "No microphone found",
  connectMic: "Connect a microphone, then try again.",
  tryAgain: "Try again",
  recordingUnavailable: "Recording is not available",
  openBrowser: "Open this page in Chrome, Edge, or Safari.",
  tooShort: "That was too short",
  speakLonger: "Speak for a second or more, then tap stop.",
  recordAgain: "Record again",
  silentTitle: "We could not hear you",
  silentBody: "Speak closer to the microphone, then try again.",
  micFailed: "The microphone did not start",
  backHome: "Back home",
  understanding: "Understanding your request…",
  usuallySeconds: "This usually takes a few seconds.",
  stepSaved: "Recording saved",
  stepListening: "Listening to Balti",
  stepPreparing: "Preparing your request",
  cancel: "Cancel",
  couldNotUnderstand: "We could not understand that",
  tryOrRecord: "Try again, or record a new message.",
  couldNotHear: "We could not hear enough",
  pleaseSpeakAgain: "Please speak again.",
  speakAgain: "Speak again",
  didWeUnderstand: "Did we understand you?",
  wantDoctorLead: "You want to speak with",
  wantDoctorHeadline: "a doctor about a health problem.",
  wantFacilityLead: "You want help finding",
  wantFacilityHeadline: "a healthcare facility.",
  understoodLead: "We understood you said",
  language: "Language",
  spokenLanguage: "Balti",
  request: "Request",
  howLong: "How long",
  doctorConsultation: "Doctor consultation",
  facilityRequest: "Find a healthcare facility",
  healthcareRequest: "Healthcare request",
  severalDays: "Several days",
  notSpecified: "Not specified",
  safety: "We only pass on what you said. We do not give medical advice.",
  yesSend: "Yes, send it",
  sending: "Sending…",
  noSpeakAgain: "No, speak again",
  couldNotSend: "Could not send your request. Try again.",
  requestSent: "Request sent",
  providerWillReply: "A healthcare provider will look at it and reply here.",
  status: "Status",
  waiting: "Waiting for provider",
  sent: "Sent",
  viewRequests: "View my requests",
  newRequest: "New request",
  noRequests: "No requests yet.",
  backToRequests: "Back to my requests",
  requestMissing: "This request is not on this device.",
};

const urdu: Copy = {
  chooseLanguage: "اپنی زبان منتخب کریں",
  changeLater: "اسے بعد میں بدل سکتے ہیں۔",
  continue: "جاری رکھیں",
  howHelp: "ہم کیا مدد کریں؟",
  homeNav: "ہوم",
  tapMic: "مائیکروفون دبائیں اور بتائیں کہ آپ کو کیا چاہیے۔",
  speakInBalti: "بلتی میں بولیں",
  requestDoctor: "ڈاکٹر سے درخواست",
  findFacility: "صحت کا مرکز تلاش کریں",
  myRequests: "میری درخواستیں",
  tapToSpeak: "بولنے کے لیے دبائیں",
  recording: "ریکارڈ ہو رہا ہے",
  speakNaturally: "بلتی میں قدرتی انداز میں بولیں۔",
  takeYourTime: "جلدی نہیں ہے۔",
  tapToStop: "روکنے کے لیے دبائیں",
  allowMic: "مائیکروفون کی اجازت دیں۔",
  micNeeded: "مائیکروفون چاہیے",
  tapAllow: "نیچے دبائیں اور Allow منتخب کریں۔",
  useMic: "مائیکروفون استعمال کریں",
  noMic: "مائیکروفون نہیں ملا",
  connectMic: "مائیکروفون جوڑیں، پھر دوبارہ کوشش کریں۔",
  tryAgain: "دوبارہ کوشش",
  recordingUnavailable: "ریکارڈنگ ممکن نہیں",
  openBrowser: "Chrome، Edge، یا Safari میں کھولیں۔",
  tooShort: "یہ بہت چھوٹا تھا",
  speakLonger: "کم از کم ایک سیکنڈ بولیں، پھر روکیں۔",
  recordAgain: "دوبارہ بولیں",
  silentTitle: "ہم آواز نہیں سن سکے",
  silentBody: "مائیکروفون کے قریب بولیں، پھر دوبارہ کوشش کریں۔",
  micFailed: "مائیکروفون شروع نہیں ہوا",
  backHome: "واپس ہوم",
  understanding: "آپ کی درخواست سمجھ رہے ہیں…",
  usuallySeconds: "اس میں چند سیکنڈ لگتے ہیں۔",
  stepSaved: "ریکارڈنگ محفوظ ہو گئی",
  stepListening: "بلتی سن رہے ہیں",
  stepPreparing: "درخواست تیار ہو رہی ہے",
  cancel: "منسوخ",
  couldNotUnderstand: "ہم سمجھ نہیں سکے",
  tryOrRecord: "دوبارہ کوشش کریں، یا نیا پیغام ریکارڈ کریں۔",
  couldNotHear: "ہم سن نہیں سکے",
  pleaseSpeakAgain: "براہ کرم دوبارہ بولیں۔",
  speakAgain: "دوبارہ بولیں",
  didWeUnderstand: "کیا ہم نے ٹھیک سمجھا؟",
  wantDoctorLead: "آپ بات کرنا چاہتے ہیں",
  wantDoctorHeadline: "ایک ڈاکٹر سے، صحت کے مسئلے کے بارے میں۔",
  wantFacilityLead: "آپ تلاش کرنا چاہتے ہیں",
  wantFacilityHeadline: "ایک صحت مرکز۔",
  understoodLead: "ہم نے یہ سمجھا",
  language: "زبان",
  spokenLanguage: "بلتی",
  request: "درخواست",
  howLong: "کب سے",
  doctorConsultation: "ڈاکٹر سے مشورہ",
  facilityRequest: "صحت کا مرکز",
  healthcareRequest: "صحت کی درخواست",
  severalDays: "کئی دنوں سے",
  notSpecified: "واضح نہیں",
  safety: "ہم صرف وہی آگے بھیجتے ہیں جو آپ نے کہا۔ ہم طبی مشورہ نہیں دیتے۔",
  yesSend: "ہاں، بھیج دیں",
  sending: "بھیج رہے ہیں…",
  noSpeakAgain: "نہیں، دوبارہ بولیں",
  couldNotSend: "درخواست نہیں بھیجی جا سکی۔ دوبارہ کوشش کریں۔",
  requestSent: "درخواست بھیج دی گئی",
  providerWillReply: "صحت فراہم کنندہ اسے دیکھے گا اور یہیں جواب دے گا۔",
  status: "کیفیت",
  waiting: "فراہم کنندہ کا انتظار",
  sent: "بھیجی گئی",
  viewRequests: "میری درخواستیں دیکھیں",
  newRequest: "نئی درخواست",
  noRequests: "ابھی کوئی درخواست نہیں۔",
  backToRequests: "درخواستوں پر واپس",
  requestMissing: "یہ درخواست اس ڈیوائس پر نہیں ہے۔",
};

export function getCopy(language: LanguageCode): Copy {
  if (language === "ur") return urdu;
  return english;
}
