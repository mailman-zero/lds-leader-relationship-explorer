export interface EventNote {
  title: string;
  note: string;
  hypothetical?: boolean;
}

export const EVENT_NOTES: Record<string, EventNote> = {
  "2008-02-03": {
    title: "President Monson sustained",
    note: "Following the passing of President Gordon B. Hinckley, Thomas S. Monson is set apart as the 16th President of the Church. Henry B. Eyring continues as a counselor; Dieter F. Uchtdorf is called from the Twelve as Second Counselor.",
  },
  "2008-04-05": {
    title: "Elder Christofferson called",
    note: "D. Todd Christofferson is sustained to the Quorum of the Twelve, filling the vacancy created when President Monson reorganized the First Presidency.",
  },
  "2009-04-04": {
    title: "Elder Andersen called",
    note: "Neil L. Andersen is sustained to the Quorum of the Twelve, filling the vacancy left by the passing of Joseph B. Wirthlin in December 2008.",
  },
  "2015-10-03": {
    title: "Three new apostles called",
    note: "After the passings of President Boyd K. Packer, Elder L. Tom Perry, and Elder Richard G. Scott in 2015, Ronald A. Rasband, Gary E. Stevenson, and Dale G. Renlund are sustained to the Quorum of the Twelve.",
  },
  "2018-01-14": {
    title: "President Nelson sustained",
    note: "Russell M. Nelson is set apart as the 17th President of the Church. Dallin H. Oaks and Henry B. Eyring are called as counselors; Dieter F. Uchtdorf continues his apostolic service in the Quorum of the Twelve.",
  },
  "2018-04-01": {
    title: "Elders Gong & Soares called",
    note: "Gerrit W. Gong and Ulisses Soares are sustained to the Quorum of the Twelve, filling the vacancies created by the calling of the First Presidency.",
  },
  "2024-04-06": {
    title: "Elder Kearon called",
    note: "Patrick Kearon is sustained to the Quorum of the Twelve, filling the vacancy left by the passing of President M. Russell Ballard in November 2023.",
  },
  "2026-02-01": {
    title: "Elders Caussé & Gilbert called",
    note: "Gérald Caussé and Clark G. Gilbert are sustained to the Quorum of the Twelve Apostles.",
    hypothetical: true,
  },
  "1830-04-06": {
    title: "Church organized — Joseph Smith sustained",
    note: "The Church of Jesus Christ of Latter-day Saints is organized on April 6, 1830. Joseph Smith Jr. is sustained as the First Elder of the Church and later as President of the High Priesthood.",
  },
  "1835-02-14": {
    title: "Quorum of the Twelve organized",
    note: "The Quorum of the Twelve Apostles is organized on February 14–28, 1835. Thomas B. Marsh is sustained as its first President. Brigham Young, Heber C. Kimball, Parley P. Pratt, and Orson Pratt are among the original Twelve.",
  },
  "1844-12-27": {
    title: "Brigham Young sustained as President",
    note: "Following the martyrdom of Joseph Smith in June 1844, the Quorum of the Twelve leads the Church for three years. Brigham Young is sustained as the second President of the Church on December 27, 1847.",
  },
};
