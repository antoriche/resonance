const messages: Array<{
  datetime: Date;
  speaker: {
    id: string;
    name?: string;
    color?: string;
    gender: "male" | "female" | "other";
  };
  text: string;
}> = [
  {
    datetime: new Date("2026-02-02 19:00:00"),
    speaker: {
      id: "1234",
      name: undefined,
      color: undefined,
      gender: "male",
    },
    text: "Hey Alice!",
  },
  {
    datetime: new Date("2026-02-02 19:00:10"),
    speaker: {
      id: "6789",
      name: undefined,
      color: undefined,
      gender: "female",
    },
    text: "Hi Bob!",
  },
  {
    datetime: new Date("2026-02-02 19:00:20"),
    speaker: {
      id: "1234",
      name: undefined,
      color: undefined,
      gender: "male",
    },
    text: "How are you?",
  },
  {
    datetime: new Date("2026-02-02 19:00:30"),
    speaker: {
      id: "6789",
      name: undefined,
      color: undefined,
      gender: "female",
    },
    text: "I'm good, thanks! And you?",
  },
  {
    datetime: new Date("2026-02-02 19:00:40"),
    speaker: {
      id: "1234",
      name: undefined,
      color: undefined,
      gender: "male",
    },
    text: "Doing well, thanks for asking!",
  },
  {
    datetime: new Date("2026-02-02 19:10:00"),
    speaker: {
      id: "5678",
      name: undefined,
      color: undefined,
      gender: "other",
    },
    text: "Hey guys, what are you talking about?",
  },
  {
    datetime: new Date("2026-02-03 19:00:00"),
    speaker: {
      id: "6789",
      name: undefined,
      color: undefined,
      gender: "female",
    },
    text: "Hey Charlie! We were just catching up.",
  },
  {
    datetime: new Date("2026-02-03 19:00:10"),
    speaker: {
      id: "5678",
      name: undefined,
      color: undefined,
      gender: "other",
    },
    text: "Cool! How have you been Bob?",
  },
  {
    datetime: new Date("2026-02-03 19:00:20"),
    speaker: {
      id: "6789",
      name: undefined,
      color: undefined,
      gender: "male",
    },
    text: "I've been good, just busy with work. How about you?",
  },
  {
    datetime: new Date("2026-02-03 19:00:30"),
    speaker: {
      id: "5678",
      name: undefined,
      color: undefined,
      gender: "other",
    },
    text: "Same here, work has been crazy. But I'm managing!",
  },
  {
    datetime: new Date("2026-02-16 19:00:40"),
    speaker: {
      id: "6789",
      name: undefined,
      color: undefined,
      gender: "male",
    },
    text: "Hey Charlie, do you want to grab lunch tomorrow?",
  },
];

export default messages;
