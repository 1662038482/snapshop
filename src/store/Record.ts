import { defineStore } from 'pinia';
import { message } from 'ant-design-vue';
import 'ant-design-vue/es/message/style/index';
import { useCaptureStore } from './Capture';
import { useConfigurationStore } from './Configuration';
import { displayColor } from './Coordinate';

export interface IRecord {
    key: string;
    x: number;
    y: number;
    c: string;
    cNative: number;
}

export interface IRecordState {
    records: IRecord[];
}

export enum AutoPickMode {
    Grid3x3 = '九宫格(3x3)',
    Grid4x4 = '大九宫格(4x4)',
    Cross = '十字形',
    Circle = '圆形',
    Diamond = '菱形'
}

export interface AutoPickConfig {
    mode: AutoPickMode;
    spacing: number;  // 间距
}

export const useRecordStore = defineStore('record', {
    state: (): IRecordState => ({
        records: [],
    }),
    actions: {
        addRecord(x: number, y: number, c: string, cNative: number, key?: string) {
            if (this.records.length >= 20) {
                message.warning('最大取点数为20个');
                return;
            }
            if (!key) {
                const key = (this.records.length + 1).toString();
                this.records.push({ key, x, y, c, cNative });
            } else {
                const index = parseInt(key) - 1;
                for (let i = 0; i < index; i++) {
                    if (!this.records[i]) {
                        this.records[i] = { key: (i + 1).toString(), x: -1, y: -1, c: '-1', cNative: -1 };
                    }
                }
                this.records[index] = { key, x, y, c, cNative };
            }
        },
        removeRecord(key?: string) {
            if (key) {
                const filtered = this.records.filter(record => record.key !== key);
                const recognized = filtered.map((record, i) => ({ ...record, key: i.toString() }));
                this.records = recognized;
            } else {
                this.records = [];
            }
        },
        refetchRecord() {
            this.records.forEach((record, index) => {
                const capture = useCaptureStore();
                const jimp = capture.activeJimp;
                const cNative = jimp.getPixelColor(record.x, record.y);
                const configuration = useConfigurationStore();
                const mode = configuration.colorMode;
                const c = displayColor(cNative, mode);
                this.records[index] = { ...record, cNative, c };
            });
        },
        async autoPick(config: AutoPickConfig) {
            if (this.records.length === 0) {
                message.warning('请先取一个基准点');
                return;
            }

            const basePoint = this.records[0];
            const capture = useCaptureStore();
            const jimp = capture.activeJimp;
            const configuration = useConfigurationStore();
            const colorMode = configuration.colorMode;
            
            const points: Array<{x: number, y: number}> = [];
            const spacing = config.spacing;

            switch (config.mode) {
                case AutoPickMode.Grid3x3:
                    // 3x3 网格
                    for (let i = -1; i <= 1; i++) {
                        for (let j = -1; j <= 1; j++) {
                            if (i === 0 && j === 0) continue; // 跳过中心点
                            points.push({
                                x: basePoint.x + i * spacing,
                                y: basePoint.y + j * spacing
                            });
                        }
                    }
                    break;

                case AutoPickMode.Grid4x4:
                    // 4x4 网格
                    for (let i = -1; i <= 2; i++) {
                        for (let j = -1; j <= 2; j++) {
                            if (i === 0 && j === 0) continue;
                            points.push({
                                x: basePoint.x + i * spacing,
                                y: basePoint.y + j * spacing
                            });
                        }
                    }
                    break;

                case AutoPickMode.Cross:
                    // 十字形
                    for (let i = -2; i <= 2; i++) {
                        if (i === 0) continue;
                        points.push({x: basePoint.x + i * spacing, y: basePoint.y}); // 横向
                        points.push({x: basePoint.x, y: basePoint.y + i * spacing}); // 纵向
                    }
                    break;

                case AutoPickMode.Circle:
                    // 圆形 8点
                    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
                    angles.forEach(angle => {
                        const radian = (angle * Math.PI) / 180;
                        points.push({
                            x: basePoint.x + Math.round(spacing * Math.cos(radian)),
                            y: basePoint.y + Math.round(spacing * Math.sin(radian))
                        });
                    });
                    break;

                case AutoPickMode.Diamond:
                    // 菱形
                    const offsets = [[0,-2], [-1,-1], [1,-1], [-2,0], [2,0], [-1,1], [1,1], [0,2]];
                    offsets.forEach(([x, y]) => {
                        points.push({
                            x: basePoint.x + x * spacing,
                            y: basePoint.y + y * spacing
                        });
                    });
                    break;
            }

            // 验证并添加有效点
            points.forEach((point, index) => {
                if (point.x >= 0 && point.x < jimp.bitmap.width && 
                    point.y >= 0 && point.y < jimp.bitmap.height) {
                    const cNative = jimp.getPixelColor(point.x, point.y);
                    const c = displayColor(cNative, colorMode);
                    this.addRecord(point.x, point.y, c, cNative);
                }
            });
        },
    },
});
