<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties} from 'vue';
import {Check, ChevronDown} from 'lucide-vue-next';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<{
  id: string;
  modelValue: string;
  options: readonly SelectOption[];
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'default' | 'sm';
}>(), {placeholder: '请选择', disabled: false, size: 'default'});
const emit = defineEmits<{
  'update:modelValue': [value: string];
  change: [value: string];
}>();

const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const activeIndex = ref(-1);
const menuStyle = ref<CSSProperties>({});
const selected = computed(() => props.options.find(option => option.value === props.modelValue));
const enabledIndices = computed(() => props.options.flatMap((option, index) => option.disabled ? [] : [index]));
const listId = computed(() => `${props.id}-listbox`);
const optionId = (index: number) => `${props.id}-option-${index}`;
let searchText = '';
let searchTimer: ReturnType<typeof setTimeout> | undefined;

function close() {
  isOpen.value = false;
  searchText = '';
  clearTimeout(searchTimer);
}

function positionMenu() {
  const rect = trigger.value?.getBoundingClientRect();
  if (!rect) return;
  const gap = 6;
  const margin = 10;
  const below = window.innerHeight - rect.bottom - gap - margin;
  const above = rect.top - gap - margin;
  const desiredHeight = Math.min(props.options.length * 36 + 10, 250);
  const openAbove = below < desiredHeight && above > below;
  const width = Math.min(Math.max(rect.width, 150), window.innerWidth - margin * 2);
  menuStyle.value = {
    width: `${width}px`,
    left: `${Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))}px`,
    maxHeight: `${Math.max(0, Math.min(250, openAbove ? above : below))}px`,
    ...(openAbove ? {bottom: `${window.innerHeight - rect.top + gap}px`} : {top: `${rect.bottom + gap}px`}),
  };
}

function revealActive() {
  nextTick(() => menu.value?.querySelector<HTMLElement>(`[data-index="${activeIndex.value}"]`)
    ?.scrollIntoView({block: 'nearest'}));
}

function open() {
  if (props.disabled || !enabledIndices.value.length) return;
  positionMenu();
  activeIndex.value = props.options.findIndex(option => option.value === props.modelValue && !option.disabled);
  if (activeIndex.value < 0) activeIndex.value = enabledIndices.value[0];
  isOpen.value = true;
  revealActive();
}

function choose(index: number) {
  const option = props.options[index];
  if (!option || option.disabled) return;
  if (option.value !== props.modelValue) {
    emit('update:modelValue', option.value);
    emit('change', option.value);
  }
  close();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') { close(); return; }
  if (event.key === 'Escape') {
    if (isOpen.value) { event.preventDefault(); event.stopPropagation(); close(); }
    return;
  }
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    if (isOpen.value) choose(activeIndex.value); else open();
    return;
  }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const wasOpen = isOpen.value;
    if (!wasOpen) open();
    const indices = enabledIndices.value;
    if (!indices.length) return;
    if (event.key === 'Home') activeIndex.value = indices[0];
    else if (event.key === 'End') activeIndex.value = indices[indices.length - 1];
    else if (wasOpen) {
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const position = indices.indexOf(activeIndex.value);
      activeIndex.value = indices[(position + direction + indices.length) % indices.length];
    }
    revealActive();
    return;
  }
  // 输入选项名称的前缀快速定位；重复输入同一字母时循环匹配。
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (!isOpen.value) open();
    searchText += event.key.toLocaleLowerCase();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { searchText = ''; }, 600);
    const query = [...searchText].every(char => char === searchText[0]) ? searchText[0] : searchText;
    const indices = enabledIndices.value;
    const start = indices.indexOf(activeIndex.value);
    for (let offset = 1; offset <= indices.length; offset++) {
      const index = indices[(start + offset) % indices.length];
      if (props.options[index].label.toLocaleLowerCase().startsWith(query)) {
        activeIndex.value = index;
        revealActive();
        break;
      }
    }
  }
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target as Node;
  if (!root.value?.contains(target) && !menu.value?.contains(target)) close();
}
function onScroll(event: Event) {
  // 允许菜单内部滚动；外部面板滚动时收起，避免浮层脱离触发按钮。
  if (!menu.value?.contains(event.target as Node)) close();
}
watch(() => [props.modelValue, props.options, props.disabled], close);
onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', close);
});
onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  document.removeEventListener('pointerdown', onOutsidePointer, true);
  document.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', close);
});
</script>

<template>
  <div ref="root" class="app-select" :class="{'app-select-small': size === 'sm'}">
    <button :id="id" ref="trigger" type="button" role="combobox" aria-haspopup="listbox"
            :aria-label="ariaLabel" :aria-controls="listId" :aria-expanded="isOpen"
            :aria-activedescendant="isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined"
            :disabled="disabled || !enabledIndices.length" class="field select-trigger" :class="{'is-open': isOpen}"
            @click="isOpen ? close() : open()" @keydown="onKeydown" @blur="close">
      <span class="select-value" :class="{'select-placeholder': !selected}">{{ selected?.label || placeholder }}</span>
      <ChevronDown :size="14" class="select-chevron" :class="{'is-open': isOpen}" aria-hidden="true"/>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" :id="listId" ref="menu" role="listbox" :aria-label="ariaLabel"
           class="select-menu" :style="menuStyle" @pointerdown.prevent>
        <div v-for="(option, index) in options" :id="optionId(index)" :key="option.value" role="option"
             :aria-selected="option.value === modelValue" :aria-disabled="option.disabled || undefined" :data-index="index"
             class="select-option" :class="{'is-selected': option.value === modelValue, 'is-active': index === activeIndex, 'is-disabled': option.disabled}"
             @pointermove="!option.disabled && (activeIndex = index)" @click="choose(index)">
          <span class="select-value">{{ option.label }}</span>
          <Check v-if="option.value === modelValue" :size="14" class="select-check" aria-hidden="true"/>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app-select { min-width: 0; }
.select-trigger { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; text-align: left; cursor: pointer; }
.select-trigger:hover:not(:disabled) { background: #252537; border-color: rgba(167,139,250,.3); }
.select-trigger.is-open { border-color: #8874d8; box-shadow: 0 0 0 3px rgba(139,92,246,.1); }
.select-trigger:disabled { opacity: .45; cursor: not-allowed; }
.select-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.select-placeholder { color: #80839d; }
.select-chevron { flex-shrink: 0; color: #9993b3; transition: transform .15s, color .15s; }
.select-chevron.is-open { color: #c4b5fd; transform: rotate(180deg); }
.app-select-small .select-trigger { min-height: 28px; padding: 4px 9px; gap: 12px; font-size: 11px; }
.select-menu { position: fixed; z-index: 200; overflow-y: auto; overscroll-behavior: contain; padding: 4px; border: 1px solid rgba(167,139,250,.22); border-radius: 10px; background: #222232; box-shadow: 0 12px 36px rgba(0,0,0,.4), 0 1px 0 rgba(255,255,255,.03) inset; color: #d5d4e5; font-size: 12px; }
.select-option { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 36px; padding: 8px 10px; border-radius: 6px; cursor: pointer; }
.select-option.is-selected { background: rgba(139,92,246,.1); color: #d3c5ff; }
.select-option.is-active { background: rgba(139,92,246,.2); color: #f1ebff; }
.select-option.is-disabled { opacity: .35; cursor: not-allowed; }
.select-check { flex-shrink: 0; color: #bda5ff; }
</style>
