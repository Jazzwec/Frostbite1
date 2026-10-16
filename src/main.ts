import Phaser from 'phaser';
import './style.css';
import './ui/overlay/overlay.css';
import { CityScene } from './scenes/CityScene';
import { CSS, GAME_HEIGHT, GAME_WIDTH } from './theme';
import { jansScreen } from './ui/overlay/JansScreen';
import { comingSoon, settingsScreen } from './ui/overlay/SettingsScreen';
import { Shell } from './ui/overlay/Shell';

const game = new Phaser.Game({
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

new Shell(game, {
  build: comingSoon('Build'),
  jans: jansScreen,
  collection: comingSoon('Collection'),
  settings: settingsScreen,
});
