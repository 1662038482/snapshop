<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useCaptureStore } from '../store/Capture';
import { useRecordStore } from '../store/Record';
import { ICapture } from '../store/Capture';
import Jimp from 'jimp/browser/lib/jimp';
import { promiseTimeout } from '@vueuse/core';
import { message } from 'ant-design-vue';
import { Empty } from 'ant-design-vue';
import { LoadingOutlined } from '@ant-design/icons-vue';

const captureStore = useCaptureStore();
const recordStore = useRecordStore();

const captures = computed(() => captureStore.captures);
const capturesCheckeds = ref<boolean[]>(Array(captures.value.length).fill(false));
const selectedCaptures = computed(() => {
    const selected: ICapture[] = [];
    captures.value.forEach((capture, index) => {
        if (capturesCheckeds.value[index] === true) {
            selected.push(capture);
        }
    });
    return selected;
});
const comparedCaptureBase64 = ref<string>('');
const tolerance = ref<number>(0);
const loading = ref<boolean>(false);

const pointCompareResults = ref<Array<{
    x: number;
    y: number;
    color1: string;
    color2: string;
    diffR: number;
    diffG: number;
    diffB: number;
    totalDiff: number;
}>>([]);

const comparePoints = () => {
    if (selectedCaptures.value.length !== 2) return;
    
    const capture1 = selectedCaptures.value[0];
    const capture2 = selectedCaptures.value[1];
    const points = recordStore.records;
    
    if (points.length === 0) {
        message.warning('请先在主面板取色后再比较');
        return;
    }

    pointCompareResults.value = points.map(point => {
        const { x, y } = point;
        
        const idx1 = (y * capture1.jimp.bitmap.width + x) * 4;
        const idx2 = (y * capture2.jimp.bitmap.width + x) * 4;
        
        const r1 = capture1.jimp.bitmap.data[idx1 + 0];
        const g1 = capture1.jimp.bitmap.data[idx1 + 1];
        const b1 = capture1.jimp.bitmap.data[idx1 + 2];
        
        const r2 = capture2.jimp.bitmap.data[idx2 + 0];
        const g2 = capture2.jimp.bitmap.data[idx2 + 1];
        const b2 = capture2.jimp.bitmap.data[idx2 + 2];

        const diffR = Math.abs(r1 - r2);
        const diffG = Math.abs(g1 - g2);
        const diffB = Math.abs(b1 - b2);
        const totalDiff = diffR + diffG + diffB;

        return {
            x,
            y,
            color1: `rgb(${r1},${g1},${b1})`,
            color2: `rgb(${r2},${g2},${b2})`,
            diffR,
            diffG,
            diffB,
            totalDiff
        };
    });
};

const handleClickReset = () => {
    capturesCheckeds.value.fill(false);
};

const compare = async () => {
    if (selectedCaptures.value.length >= 2) {
        comparedCaptureBase64.value = '';
        loading.value = true;
        await promiseTimeout(100);
        
        const capture1 = selectedCaptures.value[0];
        const capture2 = selectedCaptures.value[1];
        const width = capture1.jimp.bitmap.width;
        const height = capture1.jimp.bitmap.height;
        const jimp = new Jimp(width, height);
        
        jimp.scan(0, 0, width, height, (x, y, idx) => {
            const r1 = capture1.jimp.bitmap.data[idx + 0];
            const g1 = capture1.jimp.bitmap.data[idx + 1];
            const b1 = capture1.jimp.bitmap.data[idx + 2];
            const r2 = capture2.jimp.bitmap.data[idx + 0];
            const g2 = capture2.jimp.bitmap.data[idx + 1];
            const b2 = capture2.jimp.bitmap.data[idx + 2];
            if (Math.abs(r1 - r2) <= tolerance.value && 
                Math.abs(g1 - g2) <= tolerance.value && 
                Math.abs(b1 - b2) <= tolerance.value) {
                jimp.setPixelColor(0xffffffff, x, y);
            } else {
                jimp.setPixelColor(0xff0000ff, x, y);
            }
        });
        
        const base64 = await jimp.getBase64Async(Jimp.MIME_PNG);
        comparedCaptureBase64.value = base64;
        
        comparePoints();
        
        loading.value = false;
    }
};

watch(selectedCaptures, compare);
</script>

<template>
    <a-row class="comparer" :wrap="false">
        <a-col class="list">
            <a-list item-layout="horizontal" :data-source="captures" :locale="{ emptyText: '在主面板加载图片' }">
                <template #renderItem="{ item: capture, index }">
                    <a-list-item>
                        <a-space :style="{ marginLeft: '8px' }">
                            <a-image :width="200" :src="capture.base64" :alt="capture.title" />
                            <a-checkbox
                                v-model:checked="capturesCheckeds[index]"
                                :disabled="(capturesCheckeds[index] === false && selectedCaptures.length >= 2) || loading"
                            ></a-checkbox>
                        </a-space>
                    </a-list-item>
                </template>
            </a-list>
        </a-col>
        <a-col class="show">
            <div class="show-bar">
                <a-space :style="{ marginLeft: '8px' }">
                    <a-button @click="handleClickReset" :disabled="loading">重置</a-button>
                    <div>容差</div>
                    <div :style="{ width: '200px' }">
                        <a-slider v-model:value="tolerance" :min="0" :max="255" tooltipPlacement="bottom" :disabled="loading" @afterChange="compare" />
                    </div>
                </a-space>
            </div>
            <div v-if="pointCompareResults.length > 0" class="point-compare-results">
                <a-table :dataSource="pointCompareResults" 
                        :columns="[
                            { title: '坐标', dataIndex: 'x', 
                              customRender: ({record}) => `(${record.x}, ${record.y})` },
                            { title: '图1颜色', dataIndex: 'color1' },
                            { title: '图2颜色', dataIndex: 'color2' },
                            { title: 'R偏差', dataIndex: 'diffR' },
                            { title: 'G偏差', dataIndex: 'diffG' },
                            { title: 'B偏差', dataIndex: 'diffB' },
                            { title: '总偏差', dataIndex: 'totalDiff' }
                        ]"
                        size="small"
                        :pagination="false"
                />
            </div>
            <div class="show-result">
                <a-empty v-if="selectedCaptures.length < 2" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="选择两张图片比较" />
                <LoadingOutlined v-if="selectedCaptures.length >= 2 && comparedCaptureBase64 === ''" :style="{ fontSize: '24px' }" />
                <a-image v-if="selectedCaptures.length >= 2 && comparedCaptureBase64 !== ''" :width="500" :src="comparedCaptureBase64" />
            </div>
        </a-col>
    </a-row>
</template>

<style scoped>
.comparer {
    height: 100%;
}
.list {
    flex: 0 0 260px;
    overflow-y: scroll;
    border-right: solid #1f1f1f;
}
.show {
    height: 100%;
    width: 0;
    flex: 1 0 300px;
    display: flex;
    flex-direction: column;
}
.show-bar {
    height: 50px;
    width: 100%;
    background-color: #1f1f1f;
    overflow-x: auto;
    display: flex;
    align-items: center;
}
.show-result {
    flex: 1 0 300px;
    display: flex;
    justify-content: center;
    align-items: center;
}
.point-compare-results {
    padding: 16px;
    background: #1f1f1f;
    margin: 8px;
    border-radius: 4px;
}
</style>
