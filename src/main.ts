import Phaser from 'phaser';
import './style.css';
import { CityScene } from './scenes/CityScene';
import { CSS, GAME_HEIGHT, GAME_WIDTH } from './theme';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: CSS.snow,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true },
  scene: [CityScene],
});
