export interface PersonData {
  name: string;
}

export interface FPRoster {
  P: string;
  C1: string;
  C2: string;
}

export interface TimelineEvent {
  date: string;
  title: string;
  note: string;
  hypothetical?: boolean;
  fp: FPRoster;
  q12: string[];
}

export const PEOPLE: Record<string, PersonData> = {
  hinckley:       { name: "Gordon B. Hinckley" },
  monson:         { name: "Thomas S. Monson" },
  faust:          { name: "James E. Faust" },
  eyring:         { name: "Henry B. Eyring" },
  uchtdorf:       { name: "Dieter F. Uchtdorf" },
  nelson:         { name: "Russell M. Nelson" },
  oaks:           { name: "Dallin H. Oaks" },
  christofferson: { name: "D. Todd Christofferson" },
  packer:         { name: "Boyd K. Packer" },
  perry:          { name: "L. Tom Perry" },
  ballard:        { name: "M. Russell Ballard" },
  wirthlin:       { name: "Joseph B. Wirthlin" },
  scott:          { name: "Richard G. Scott" },
  hales:          { name: "Robert D. Hales" },
  holland:        { name: "Jeffrey R. Holland" },
  bednar:         { name: "David A. Bednar" },
  cook:           { name: "Quentin L. Cook" },
  andersen:       { name: "Neil L. Andersen" },
  rasband:        { name: "Ronald A. Rasband" },
  stevenson:      { name: "Gary E. Stevenson" },
  renlund:        { name: "Dale G. Renlund" },
  gong:           { name: "Gerrit W. Gong" },
  soares:         { name: "Ulisses Soares" },
  kearon:         { name: "Patrick Kearon" },
  causse:         { name: "Gérald Caussé" },
};

export const EVENTS: TimelineEvent[] = [
  {
    date: "2008-02-03",
    title: "President Monson sustained",
    note: "Following the passing of President Gordon B. Hinckley, Thomas S. Monson is set apart as the 16th President of the Church. Henry B. Eyring continues as a counselor; Dieter F. Uchtdorf is called from the Twelve as Second Counselor.",
    fp: { P: "monson", C1: "eyring", C2: "uchtdorf" },
    q12: ["packer","perry","nelson","oaks","ballard","wirthlin","scott","hales","holland","bednar","cook"],
  },
  {
    date: "2008-04-05",
    title: "Elder Christofferson called",
    note: "D. Todd Christofferson is sustained to the Quorum of the Twelve, filling the vacancy created when President Monson reorganized the First Presidency.",
    fp: { P: "monson", C1: "eyring", C2: "uchtdorf" },
    q12: ["packer","perry","nelson","oaks","ballard","wirthlin","scott","hales","holland","bednar","cook","christofferson"],
  },
  {
    date: "2009-04-04",
    title: "Elder Andersen called",
    note: "Neil L. Andersen is sustained to the Quorum of the Twelve, filling the vacancy left by the passing of Joseph B. Wirthlin in December 2008.",
    fp: { P: "monson", C1: "eyring", C2: "uchtdorf" },
    q12: ["packer","perry","nelson","oaks","ballard","scott","hales","holland","bednar","cook","christofferson","andersen"],
  },
  {
    date: "2015-10-03",
    title: "Three new apostles called",
    note: "After the passings of President Boyd K. Packer, Elder L. Tom Perry, and Elder Richard G. Scott in 2015, Ronald A. Rasband, Gary E. Stevenson, and Dale G. Renlund are sustained to the Quorum of the Twelve.",
    fp: { P: "monson", C1: "eyring", C2: "uchtdorf" },
    q12: ["nelson","oaks","ballard","hales","holland","bednar","cook","christofferson","andersen","rasband","stevenson","renlund"],
  },
  {
    date: "2018-01-14",
    title: "President Nelson sustained",
    note: "Russell M. Nelson is set apart as the 17th President of the Church. Dallin H. Oaks and Henry B. Eyring are called as counselors; Dieter F. Uchtdorf returns to his seat in the Quorum of the Twelve.",
    fp: { P: "nelson", C1: "oaks", C2: "eyring" },
    q12: ["ballard","holland","bednar","uchtdorf","cook","christofferson","andersen","rasband","stevenson","renlund"],
  },
  {
    date: "2018-03-31",
    title: "Elders Gong & Soares called",
    note: "Gerrit W. Gong and Ulisses Soares are sustained to the Quorum of the Twelve, filling the vacancies created by the calling of the First Presidency.",
    fp: { P: "nelson", C1: "oaks", C2: "eyring" },
    q12: ["ballard","holland","bednar","uchtdorf","cook","christofferson","andersen","rasband","stevenson","renlund","gong","soares"],
  },
  {
    date: "2023-12-09",
    title: "Elder Kearon called",
    note: "Patrick Kearon is sustained to the Quorum of the Twelve, filling the vacancy left by the passing of President M. Russell Ballard in November 2023.",
    fp: { P: "nelson", C1: "oaks", C2: "eyring" },
    q12: ["holland","bednar","uchtdorf","cook","christofferson","andersen","rasband","stevenson","renlund","gong","soares","kearon"],
  },
  {
    date: "2026-03-01",
    title: "March 2026 — Current",
    hypothetical: true,
    note: "As reflected in the March 2026 General Authority chart: Dallin H. Oaks presides as President; D. Todd Christofferson serves as Second Counselor; Gérald Caussé has been called to the Quorum of the Twelve. One seat remains vacant pending a future call.",
    fp: { P: "oaks", C1: "eyring", C2: "christofferson" },
    q12: ["bednar","uchtdorf","cook","andersen","rasband","stevenson","renlund","gong","soares","kearon","causse"],
  },
];
