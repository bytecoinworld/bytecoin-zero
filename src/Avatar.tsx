// Copyright 2019 The Bytecoin developers.
// Licensed under the GNU Affero General Public License, version 3.

import React, {useEffect, useState} from 'react';
import * as util from './lib/util';
import styles from './css/Avatar.module.css';

// @ts-ignore
import {inner} from 'gridy-avatars';

const Avatar = React.memo((props: {
  message: string,
  onColorChange?: (message: string, color: string) => void,
}) => {
  const {message, onColorChange} = props;
  const [content, setContent] = useState('');

  useEffect(() => {
    util.digest(message.trim().normalize('NFKD')).then((d) => {
      const arr = new Uint8Array(d);

      const body       = arr[0] & 7;
      const bodyColor  = arr[1] & 7;
      const eyes       = arr[2] & 7;
      const eyesColor  = arr[3] & 7;
      const mouth      = arr[4] & 7;
      const mouthColor = arr[5] & 7;
      const avatar = inner(`${body}${bodyColor}${eyes}${eyesColor}${mouth}${mouthColor}`);
      const colorMatch = avatar.match(/<g style="fill: (#[0-9a-f]{6})"/i);
      const baseColor = colorMatch && colorMatch[1];
      if (baseColor && onColorChange) {
        onColorChange(message, baseColor);
      }

      const svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" style="isolation:isolate" viewBox="0 0 24 24" version="1.1">',
        avatar,
        '</svg>'
      ].join('');

      setContent(svg);
    });
  }, [message, onColorChange]);

  return (
    <div className={styles.avatar} dangerouslySetInnerHTML={{__html: content}}>
    </div>
  );
});

export default Avatar;
