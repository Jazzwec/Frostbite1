import Phaser from 'phaser';
import './style.css';
import './ui/overlay/overlay.css';
import { lastSeen } from './game/runtime';
import { CityScene } from './scenes/CityScene';
import { CSS, GAME_HEIGHT, GAME_WIDTH } from './theme';
import { buildScreen } from './ui/overlay/BuildScreen';
import { collectionScreen } from './ui/overlay/CollectionScreen';
import { jansScreen } from './ui/overlay/JansScreen';
import { Banner } from './ui/overlay/Banner';
import { MilestoneCards } from './ui/overlay/MilestoneCards';
import { showWelcome } from './ui/overlay/Welcome';
import { settingsScreen } from './ui/overlay/SettingsScreen';
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
  build: buildScreen,
  jans: jansScreen,
  collection: collectionScreen,
  settings: settingsScreen,
});

const layer = document.getElementById('ui')!;
new Banner(layer);
new MilestoneCards(layer);
showWelcome(layer, lastSeen);
