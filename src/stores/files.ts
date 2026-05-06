import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import type {VideoFile} from '../types';

export const useFilesStore = defineStore('files', () => {
    const currentDir = ref('');
    const recentDirs = ref<string[]>([]);
    const files = ref<VideoFile[]>([]);
    const isLoading = ref(false);
    const searchQuery = ref('');
    const filterExt = ref('');

    const filteredFiles = computed(() => {
        let result = files.value;
        if (searchQuery.value) {
            const query = searchQuery.value.toLowerCase();
            result = result.filter((f) => f.name.toLowerCase().includes(query));
        }
        if (filterExt.value) {
            result = result.filter((f) => f.ext === filterExt.value);
        }
        return result;
    });

    const selectedFiles = computed(() => files.value.filter((f) => f.selected));
    const selectedCount = computed(() => selectedFiles.value.length);
    const totalCount = computed(() => files.value.length);
    const totalSize = computed(() => {
        return files.value.reduce((sum, f) => sum + f.size, 0);
    });

    const extensions = computed(() => {
        const extSet = new Set(files.value.map((f) => f.ext));
        return Array.from(extSet).sort();
    });

    function setFiles(newFiles: VideoFile[]) {
        files.value = newFiles.map((f) => ({...f, selected: true}));
    }

    function toggleFile(path: string) {
        const file = files.value.find((f) => f.path === path);
        if (file) {
            file.selected = !file.selected;
        }
    }

    function selectAll() {
        files.value.forEach((f) => (f.selected = true));
    }

    function deselectAll() {
        files.value.forEach((f) => (f.selected = false));
    }

    function invertSelection() {
        files.value.forEach((f) => (f.selected = !f.selected));
    }

    function setCurrentDir(dir: string) {
        currentDir.value = dir;
    }

    function setRecentDirs(dirs: string[]) {
        recentDirs.value = dirs;
    }

    function reset() {
        files.value = [];
        currentDir.value = '';
        searchQuery.value = '';
        filterExt.value = '';
    }

    return {
        currentDir,
        recentDirs,
        files,
        isLoading,
        searchQuery,
        filterExt,
        filteredFiles,
        selectedFiles,
        selectedCount,
        totalCount,
        totalSize,
        extensions,
        setFiles,
        toggleFile,
        selectAll,
        deselectAll,
        invertSelection,
        setCurrentDir,
        setRecentDirs,
        reset,
    };
});
