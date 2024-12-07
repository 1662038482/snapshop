<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRecordStore } from '../store/Record';
import { useAreaStore } from '../store/Area';
import { IRecord } from '../store/Record';
import { useControlCv } from '../plugins/ControlCv';
import { displayColor } from '../store/Coordinate';
import { ColorMode } from '../store/Configuration';
import { ColumnsType } from 'ant-design-vue/es/table';
import { CopyOutlined, DeleteOutlined, ScissorOutlined, DownloadOutlined, PlusCircleOutlined, ClearOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useCaptureStore } from '../store/Capture';
import { message } from 'ant-design-vue';
import { AutoPickMode } from '../store/Record';

const recordStore = useRecordStore();
const areaStore = useAreaStore();
const controlCv = useControlCv();
const captureStore = useCaptureStore();

const pointsColumns: ColumnsType = [
    { title: '坐标', dataIndex: 'xy', width: '33%', align: 'center' },
    { title: '颜色值', dataIndex: 'c', width: '33%', align: 'center' },
    { title: '操作', dataIndex: 'action', width: '34%', align: 'center' },
];
const areaColumns: ColumnsType = [
    { title: '范围', dataIndex: 'area', width: '40%', align: 'center' },
    { title: '操作', dataIndex: 'action', width: '60%', align: 'center' },
];

const records = computed(() => recordStore.records);
const areas = computed(() => {
    const { x1, y1, x2, y2 } = areaStore;
    if (x1 === -1 && y1 === -1 && x2 === -1 && y2 === -1) {
        return [];
    } else {
        return [areaStore];
    }
});

const autoPickMode = ref<AutoPickMode>(AutoPickMode.Grid3x3);
const autoPickSpacing = ref<number>(20);

const analyzeMaxPoints = ref<number>(10);
const analyzeTolerance = ref<number>(10);
const analyzeSpacing = ref<number>(10);

const handleClickCopyText = (txt: string) => {
    controlCv.ctrlC(txt);
};
const handleClickCopyRecord = (record: IRecord) => {
    controlCv.ctrlC(`${record.x},${record.y},${record.c}`);
};
const handleClickRemoveRecord = (record: IRecord) => {
    recordStore.removeRecord(record.key);
};
const handleClickCopyArea = (record: { x1: number; y1: number; x2: number; y2: number }) => {
    controlCv.ctrlC(`${record.x1},${record.y1},${record.x2},${record.y2}`);
};
const handleClickResetArea = () => {
    areaStore.resetArea();
};
const handleClickCropArea = async (record: { x1: number; y1: number; x2: number; y2: number }) => {
    try {
        await captureStore.cropCapture(record.x1, record.y1, record.x2, record.y2);
        areaStore.resetArea();
        message.success('裁剪成功');
    } catch (error) {
        message.error('裁剪失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
};
const handleClickSaveCroppedImage = async (record: { x1: number; y1: number; x2: number; y2: number }) => {
    try {
        const key = await captureStore.cropCapture(record.x1, record.y1, record.x2, record.y2);
        await captureStore.saveCapture(key);
        areaStore.resetArea();
        message.success('裁剪并保存成功');
    } catch (error) {
        message.error('保存失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
};
const handleClickAutoPick = async () => {
    try {
        await recordStore.autoPick({
            mode: autoPickMode.value,
            spacing: autoPickSpacing.value
        });
        message.success('智能取色完成');
    } catch (error) {
        message.error('智能取色失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
};
const handleClickClearAllRecords = () => {
    recordStore.removeRecord();
    message.success('已清空所有取色点');
};
const handleClickAnalyzeArea = async () => {
    try {
        recordStore.removeRecord();
        
        const count = await areaStore.analyzeArea({
            maxPoints: analyzeMaxPoints.value,
            tolerance: analyzeTolerance.value,
            spacing: analyzeSpacing.value
        });
        message.success(`智能分析完成，找到 ${count} 个特征点`);
    } catch (error) {
        message.error('分析失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
};
</script>

<template>
    <a-space direction="vertical" style="width: 100%; margin-bottom: 16px">
        <a-row :gutter="8">
            <a-col :span="13">
                <a-select v-model:value="autoPickMode" style="width: 100%">
                    <a-select-option :value="AutoPickMode.Grid3x3">九宫格(3x3)</a-select-option>
                    <a-select-option :value="AutoPickMode.Grid4x4">大九宫格(4x4)</a-select-option>
                    <a-select-option :value="AutoPickMode.Cross">十字形</a-select-option>
                    <a-select-option :value="AutoPickMode.Circle">圆形</a-select-option>
                    <a-select-option :value="AutoPickMode.Diamond">菱形</a-select-option>
                </a-select>
            </a-col>
            <a-col :span="10">
                <a-input-number 
                    v-model:value="autoPickSpacing"
                    :min="5"
                    :max="100"
                    addon-before="间距"
                    style="width: 100%"
                    @keydown.stop
                />
            </a-col>
        </a-row>
        <a-row :gutter="8">
            <a-col :span="24" style="display: flex; gap: 8px;">
                <a-button 
                    type="primary"
                    @click="handleClickAutoPick"
                    :disabled="!records.length"
                >
                    <template #icon><PlusCircleOutlined /></template>
                    智能取色
                </a-button>
                <a-button 
                    danger
                    @click="handleClickClearAllRecords"
                    :disabled="!records.length"
                >
                    <template #icon><ClearOutlined /></template>
                    清空
                </a-button>
            </a-col>
        </a-row>
    </a-space>
    <a-table :columns="pointsColumns" :data-source="records" bordered size="small" :pagination="false">
        <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'xy'">
                <span style="cursor: pointer" @click="() => handleClickCopyText(`${record.x},${record.y}`)">{{ `${record.x},${record.y}` }}</span>
            </template>
            <template v-if="column.dataIndex === 'c'">
                <a-tag class="tag" :color="displayColor(record.cNative, ColorMode.hexWithPound)">
                    <span style="cursor: pointer" @click="() => handleClickCopyText(record.c)">{{ record.c }}</span>
                </a-tag>
            </template>
            <template v-if="column.dataIndex === 'action'">
                <a-space size="middle">
                    <CopyOutlined @click="() => handleClickCopyRecord(record)" />
                    <DeleteOutlined @click="() => handleClickRemoveRecord(record)" />
                </a-space>
            </template>
        </template>
        <template #emptyText>
            {{ '鼠标左键/数字键1-9开始取色' }}
        </template>
    </a-table>
    <a-table :columns="areaColumns" :data-source="areas" bordered size="small" :pagination="false">
        <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'area'">
                <span style="cursor: pointer" @click="() => handleClickCopyText(`${record.x1},${record.y1}`)">
                    {{ `${record.x1},${record.y1}, ` }}
                </span>
                <span style="cursor: pointer" @click="() => handleClickCopyText(`${record.x2},${record.y2}`)">
                    {{ `${record.x2},${record.y2}` }}
                </span>
            </template>
            <template v-if="column.dataIndex === 'action'">
                <a-space size="middle">
                    <CopyOutlined @click="() => handleClickCopyArea(record)" />
                    <ScissorOutlined @click="() => handleClickCropArea(record)" />
                    <DownloadOutlined @click="() => handleClickSaveCroppedImage(record)" />
                    <DeleteOutlined @click="handleClickResetArea" />
                    <a-popover title="智能分析配置" trigger="click">
                        <template #content>
                            <a-space direction="vertical" style="width: 200px">
                                <a-input-number
                                    v-model:value="analyzeMaxPoints"
                                    :min="1"
                                    :max="20"
                                    addon-before="最大点数"
                                    style="width: 100%"
                                    @keydown.stop
                                />
                                <a-input-number
                                    v-model:value="analyzeTolerance"
                                    :min="0"
                                    :max="255"
                                    addon-before="颜色容差"
                                    style="width: 100%"
                                    @keydown.stop
                                />
                                <a-input-number
                                    v-model:value="analyzeSpacing"
                                    :min="1"
                                    :max="50"
                                    addon-before="分析间距"
                                    style="width: 100%"
                                    @keydown.stop
                                />
                                <a-button type="primary" @click="handleClickAnalyzeArea">
                                    开始分析
                                </a-button>
                            </a-space>
                        </template>
                        <SearchOutlined />
                    </a-popover>
                </a-space>
            </template>
        </template>
        <template #emptyText>
            {{ 'Q/E开始选取范围' }}
        </template>
    </a-table>
</template>

<style scoped>
.tag {
    width: 100%;
    text-shadow: #000 1px 0 0, #000 0 1px 0, #000 -1px 0 0, #000 0 -1px 0;
}
</style>
