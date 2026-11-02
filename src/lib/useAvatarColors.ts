import React, {useCallback, useState} from 'react';

type AvatarColorStyle = React.CSSProperties & {
  '--avatar-color': string,
  '--avatar-animation-delay': string,
};

const AVATAR_BORDER_ANIMATION_DURATION_SECONDS = 8;

const useAvatarColors = () => {
  const [avatarColors, setAvatarColors] = useState<Record<string, string>>({});

  const updateAvatarColor = useCallback((address: string, color: string) => {
    setAvatarColors((current) => current[address] === color ? current : {...current, [address]: color});
  }, []);

  const getAvatarColorStyle = useCallback((
    address: string,
    index: number,
    addressCount: number,
  ): AvatarColorStyle | undefined => {
    const color = avatarColors[address];
    if (!color) {
      return undefined;
    }

    const animationDelay = addressCount ?
      -(index / addressCount) * AVATAR_BORDER_ANIMATION_DURATION_SECONDS :
      0;
    return {
      '--avatar-color': color,
      '--avatar-animation-delay': `${animationDelay}s`,
    };
  }, [avatarColors]);

  return {avatarColors, updateAvatarColor, getAvatarColorStyle};
};

export default useAvatarColors;
