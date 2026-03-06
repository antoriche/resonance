import React from "react";

type AvatarProps = {
  seed: string;
  gender: "male" | "female" | "other";
  color: string;
  style?: React.CSSProperties;
};
const Avatar: React.FC<AvatarProps> = ({ seed, gender, color, style }) => {
  const genderAttributes: Record<string, string[]> = {
    male: {
      hair: [
        "bald",
        "balding",
        "beanie",
        "buzzcut",
        "cap",
        "fade",
        "shortCombover",
        "shortComboverChops",
      ],
    },
    female: {
      hair: [
        "bobBangs",
        "bobCut",
        "curly",
        "curlyBun",
        "curlyHighTop",
        "extraLong",
        "long",
        "pigtails",
        "sideShave",
        "straightBun",
      ],
    },
  }[gender as string] || {
    hair: ["beanie", "bunUndercut", "buzzcut", "cap", "curlyHighTop", "mohawk"],
  };
  const genderAttributesString = Object.entries(genderAttributes)
    .map(([key, value]) => `${key}=${value.join(",")}`)
    .join("&");
  const colorWithoutHash = color.replace("#", "");
  const link = `https://api.dicebear.com/9.x/personas/svg?seed=${seed}&${genderAttributesString}&backgroundColor=${colorWithoutHash}`;
  return <img style={style} src={link} alt="avatar" />;
};

export default Avatar;
