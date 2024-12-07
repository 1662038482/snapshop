import { defineStore } from 'pinia';
import { useRecordStore } from './Record';
import { useCaptureStore } from './Capture';
import { useConfigurationStore } from './Configuration';
import { displayColor } from './Coordinate';

export interface IAreaState {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface IAreaAnalyzeConfig {
    maxPoints: number;     // 最大取点数
    tolerance: number;     // 颜色容差
    spacing: number;      // 分析间距
}

interface RGB {
    r: number;
    g: number;
    b: number;
}

interface AnalyzePoint {
    x: number;
    y: number;
    similarity: number;
    rgb: RGB;
}

export const useAreaStore = defineStore('area', {
    state: (): IAreaState => ({
        x1: -1,
        y1: -1,
        x2: -1,
        y2: -1,
    }),
    actions: {
        updateArea(x1: number, y1: number, x2: number, y2: number) {
            this.x1 = x1;
            this.y1 = y1;
            this.x2 = x2;
            this.y2 = y2;
        },
        resetArea() {
            this.x1 = -1;
            this.y1 = -1;
            this.x2 = -1;
            this.y2 = -1;
        },
        async analyzeArea(config: IAreaAnalyzeConfig) {
            const recordStore = useRecordStore();
            const captureStore = useCaptureStore();
            const jimp = captureStore.activeJimp;
            const configurationStore = useConfigurationStore();

            // 确保坐标正确
            const startX = Math.min(this.x1, this.x2);
            const endX = Math.max(this.x1, this.x2);
            const startY = Math.min(this.y1, this.y2);
            const endY = Math.max(this.y1, this.y2);

            const analyzeResults: AnalyzePoint[] = [];
            const colorGroups: AnalyzePoint[][] = [];

            // 遍历区域内的点
            for (let x = startX; x <= endX; x += config.spacing) {
                for (let y = startY; y <= endY; y += config.spacing) {
                    const centerColor = jimp.getPixelColor(x, y);
                    const centerRgb = {
                        r: (centerColor >> 24) & 0xff,
                        g: (centerColor >> 16) & 0xff,
                        b: (centerColor >> 8) & 0xff,
                    };

                    // 8个方向的偏移量
                    const directions = [
                        [-1,-1], [0,-1], [1,-1],
                        [-1,0],         [1,0],
                        [-1,1],  [0,1],  [1,1]
                    ];

                    // 检查8个方向的相似度
                    let similarCount = 0;
                    for (const [dx, dy] of directions) {
                        const checkX = x + dx * config.spacing;
                        const checkY = y + dy * config.spacing;
                        
                        if (checkX >= 0 && checkX < jimp.bitmap.width &&
                            checkY >= 0 && checkY < jimp.bitmap.height) {
                            const neighborColor = jimp.getPixelColor(checkX, checkY);
                            const neighborRgb = {
                                r: (neighborColor >> 24) & 0xff,
                                g: (neighborColor >> 16) & 0xff,
                                b: (neighborColor >> 8) & 0xff,
                            };

                            if (Math.abs(centerRgb.r - neighborRgb.r) <= config.tolerance &&
                                Math.abs(centerRgb.g - neighborRgb.g) <= config.tolerance &&
                                Math.abs(centerRgb.b - neighborRgb.b) <= config.tolerance) {
                                similarCount++;
                            }
                        }
                    }

                    if (similarCount > 0) {
                        const point: AnalyzePoint = {
                            x,
                            y,
                            similarity: similarCount,
                            rgb: centerRgb
                        };

                        // 尝试将点加入现有颜色组
                        let foundGroup = false;
                        for (const group of colorGroups) {
                            const groupColor = group[0].rgb;
                            if (Math.abs(groupColor.r - centerRgb.r) <= config.tolerance * 2 &&
                                Math.abs(groupColor.g - centerRgb.g) <= config.tolerance * 2 &&
                                Math.abs(groupColor.b - centerRgb.b) <= config.tolerance * 2) {
                                group.push(point);
                                foundGroup = true;
                                break;
                            }
                        }

                        // 如果没有找到匹配的颜色组，创建新组
                        if (!foundGroup) {
                            colorGroups.push([point]);
                        }
                    }
                }
            }

            // 先找出相似度最高的点作为第一个点
            const allPoints = colorGroups.flat();
            const firstPoint = allPoints.sort((a, b) => b.similarity - a.similarity)[0];
            analyzeResults.push(firstPoint);

            // 从每个颜色组中选择最佳点（排除已选的第一个点）
            const remainingMaxPoints = config.maxPoints - 1;
            const maxPointsPerGroup = Math.max(1, Math.floor(remainingMaxPoints / (colorGroups.length - 1)));
            
            for (const group of colorGroups) {
                // 过滤掉已选的第一个点
                const filteredGroup = group.filter(p => p !== firstPoint);
                if (filteredGroup.length === 0) continue;

                // 按相似度排序
                const sortedGroup = filteredGroup.sort((a, b) => b.similarity - a.similarity);
                // 取每组的前N个点
                analyzeResults.push(...sortedGroup.slice(0, maxPointsPerGroup));
            }

            // 如果总点数还不够，从剩余点中补充
            if (analyzeResults.length < config.maxPoints) {
                const remainingPoints = colorGroups
                    .flatMap(group => group.filter(p => p !== firstPoint).slice(maxPointsPerGroup))
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, config.maxPoints - analyzeResults.length);
                analyzeResults.push(...remainingPoints);
            }

            // 限制最终点数
            const finalResults = analyzeResults.slice(0, config.maxPoints);

            // 添加到记录中
            for (const result of finalResults) {
                const color = jimp.getPixelColor(result.x, result.y);
                const colorStr = displayColor(color, configurationStore.colorMode);
                recordStore.addRecord(result.x, result.y, colorStr, color);
            }

            return finalResults.length;
        }
    },
});

