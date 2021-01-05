<template>
  <div class="fill-height">
    <v-container
      fluid
      pa-0
      ma-0
      :class="`container ${$vuetify.breakpoint.smAndDown ? 'small' : ''}`"
      ref="scroll-target"
    >
      <v-list two-line subheader dense nav color="surfaceVariant" class="pt-1">
        <v-list-item
          v-for="(clip, index) in clipsObserver"
          :key="clip.id"
          @mouseover="onClipHover(clips[index])"
          @click="onClipClick(clips[index])"
        >
          <v-list-item-content>
            <v-list-item-title
              v-if="
                displayType[clip.id].availableTypes[
                  displayType[clip.id].index
                ] === 'plainText'
              "
              v-text="clip.preview"
            ></v-list-item-title>
            <v-img
              v-else-if="
                displayType[clip.id].availableTypes[
                  displayType[clip.id].index
                ] === 'dataURI'
              "
              style="border-radius: 5px; max-height: 64px"
              :src="clip.dataURI"
              :alt="clip.preview"
            ></v-img>
            <v-list-item-title v-else>
              <div
                v-dompurify-html="clip.htmlText"
                style="border-radius: 5px; max-height: 64px"
              ></div>
            </v-list-item-title>
            <v-list-item-subtitle v-text="clip.fromNow"></v-list-item-subtitle>
          </v-list-item-content>

        </v-list-item>
      </v-list>
    </v-container>
  </div>
</template>

<script lang="ts">
import { Component,Prop } from 'vue-property-decorator';
import { fromEvent } from 'rxjs';
import AppBar from '@/components/AppBar.vue';
import SearchBar from '@/components/SearchBar.vue';
import { Clip, User } from '@/store/types';
import { Getter, Action } from 'vuex-class';
import { ClipSearchConditions, SearchFilters } from '@/rxdb/clips/model';
import * as utils from '@/rxdb/clips/utils';
import { ExtendedVue } from '@/utils/base-vue';
import moment from 'moment';
import electron from 'electron';
import {
  map,
  filter,
  concatMap,
  distinctUntilChanged,
  debounceTime,
  tap,
} from 'rxjs/operators';
import { WatchObservable } from 'vue-rx';

type ClipEx = Clip & { fromNow?: string; preview?: string };

@Component<Home>({

})
export default class Home extends ExtendedVue {
  // @Prop({ required: true })
  // public translations!: unknown;
  @Action('loadClips', { namespace: 'clips' })
  public loadClips!: (
    searchConditions: Partial<ClipSearchConditions>
  ) => Promise<Clip[]>;
  @Action('loadNext', { namespace: 'clips' })
  public loadNext!: (
    searchConditions: Partial<ClipSearchConditions>
  ) => Promise<Clip[]>;
  @Action('modifyClip', { namespace: 'clips' })
  public modifyClip!: (payload: {
    clip: Clip;
    options?: { silently?: boolean };
  }) => Promise<Clip[]>;
  @Action('removeClips', { namespace: 'clips' })
  public removeClips!: (ids: string[]) => Promise<Clip[]>;
  @Action('copyToClipboard', { namespace: 'clips' })
  public copyToClipboard!: (args: {
    type: 'text' | 'image';
    payload: string;
  }) => Promise<void>;
  @Action('uploadJson', { namespace: 'clips' })
  public uploadJson!: () => Promise<Clip[]>;
  @Action('fromDump', { namespace: 'clips' })
  public fromDump!: () => Promise<Clip[]>;
  @Action('downloadJson', { namespace: 'clips' })
  public downloadJson!: (clips: Clip[]) => Promise<Clip[]>;
  @Action('uploadToDrive', { namespace: 'clips' })
  public uploadToDrive!: (args?: {
    clip: Clip;
    threshold: number;
  }) => Promise<Clip[]>;
  @Getter('user', { namespace: 'user' })
  public user!: User;
  @Getter('clips', { namespace: 'clips' })
  public clips!: Clip[];
  @Getter('loading', { namespace: 'clips' })
  public loading!: boolean;
  @Getter('processing', { namespace: 'clips' })
  public processing!: Clip[];
  @Getter('syncStatus', { namespace: 'clips' })
  public syncStatus?: 'pending' | 'resolved' | 'rejected';
  public searchConditions: Partial<ClipSearchConditions> & {
    filters: Partial<SearchFilters>;
  } = {
    limit: 15,
    sort: '-updatedAt',
    filters: {},
  };
  public mode: 'normal' | 'select' = 'normal';
  public removeTarget: { [id: string]: boolean } = {};
  public displayType: {
    [id: string]: {
      availableTypes: Array<'plainText' | 'richText' | 'dataURI' | 'htmlText'>;
      index: number;
    };
  } = {};
  public dateTime: number = Date.now();

  public snackbar = false;
  public snackbarText = '';

  public get clipCount(): number {
    return this.mode === 'select'
      ? Object.entries(this.removeTarget).length
      : this.clips.length;
  }

  public onClipHover(clip: ClipEx): void {
    this.dateTime = clip.updatedAt;
  }

  public goNext(event: Event, id: string): void {
    event.stopPropagation();
    const target = this.displayType[id];
    this.displayType = {
      ...this.displayType,
      [id]: {
        availableTypes: target.availableTypes,
        index:
          target.index + 1 < target.availableTypes.length
            ? target.index + 1
            : 0,
      },
    };
  }

  public onClipClick(clip: Clip): void {
    const target = this.displayType[clip.id];
    const type = target.availableTypes[target.index];
    this.copyToClipboard({
      type: type === 'dataURI' ? 'image' : 'text',
      payload: clip[type],
    });
    const mainWindow = electron.remote.getCurrentWindow();
    //if (mainWindow.isVisible() && this.settings.system.blur) {
    if (mainWindow.isVisible() && this.settings.system.blur) {
      setTimeout(mainWindow.hide, 0);
    }
  }

  public async onStarClick(event: Event, clip: Clip): Promise<void> {
    event.stopPropagation();
    await this.modifyClip({
      clip: {
        ...clip,
        category: clip.category === 'starred' ? 'none' : 'starred',
      },
      options: { silently: true },
    });
  }

  public async onAddLabelClick(event: Event, clip: Clip, labelName:string): Promise<void> {
    clip.label  = [labelName];
    await this.modifyClip({
      clip: {
        ...clip,
        category: 'starred'
      },
      options: { silently: true },
    });
  }

  public async onRemoveCLick(event: Event, clip: ClipEx): Promise<void> {
    event.stopPropagation();
    this.removeTarget = {
      ...this.removeTarget,
      [clip.id]: !this.removeTarget[clip.id],
    };
  }

  public async onRemoveItems(): Promise<void> {
    const removeTarget = this.removeTarget;
    this.removeTarget = {};
    const ids = Object.entries(removeTarget).reduce(
      (acc, [key, value]) => (value ? [key, ...acc] : acc),
      [] as string[]
    );
    await this.removeClips(ids);
    this.mode = 'normal';
  }

  public onChangeMode(mode: 'normal' | 'select'): void {
    this.mode = mode;
  }

  public onChangeType(type?: 'text' | 'image'): Promise<Clip[]> {
    this.searchConditions.filters = {
      ...this.searchConditions.filters,
      type,
    };
    return this.loadClips(this.searchConditions);
  }

  public onChangeCategory(category?: 'none' | 'starred'): Promise<Clip[]> {
    this.searchConditions.filters = {
      ...this.searchConditions.filters,
      category,
    };
    return this.loadClips(this.searchConditions);
  }

  // eslint-disable-next-line no-undef
  public timeout?: NodeJS.Timeout;
  public search(value: string): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(async () => {
      const regex = (() => {
        if (value) {
          switch (this.settings.storage.search.type) {
            case 'fuzzy':
              return utils.patterns.likeSearch('plainText', value);
            case 'advanced-fuzzy':
              return utils.patterns.advancedSearch(
                'plainText',
                value.split(' ')
              );
          }
        }
      })();

      this.searchConditions = {
        ...this.searchConditions,
        regex,
        filters:
          value && !regex
            ? { ...this.searchConditions.filters, plainText: value }
            : { ...this.searchConditions.filters, plainText: undefined },
      };

      return this.loadClips(this.searchConditions);
    }, 500);
  }

  public async syncWithDrive(): Promise<void> {
    if (this.user) {
      const clips = await this.uploadToDrive();
      this.snackbarText =
        clips.length > 0
          ? this.$replacer(this.$translations.itemsHaveBeenUploaded, {
              length: clips.length,
            })
          : this.$translations.alreadySyncedWith;
    } else {
      this.snackbarText = 'Sign-in to sync with Google Drive';
    }

    this.snackbar = true;
  }

  public infiniteScroll(): ReturnType<typeof fromEvent> {
    return fromEvent(this.$refs['scroll-target'] as Element, 'scroll').pipe(
      map((event) => {
        const taregt = event?.target as Element; // TODO check for undefined
        const scrollY = taregt.scrollTop;
        const visiblePortion = taregt.clientHeight;
        const pageHeight = taregt.scrollHeight;
        const isBottom = visiblePortion + scrollY >= pageHeight;
        return isBottom;
      }),
      distinctUntilChanged(),
      filter((value) => value && !this.loading),
      debounceTime(100)
    );
  }

  public async mounted(): Promise<void> {
    this.loadClips(this.searchConditions);
    this.$subscribeTo(
      this.infiniteScroll().pipe(
        concatMap(() => this.loadNext(this.searchConditions))
      ),
      () => {
        // const target = this.$refs['scroll-target'] as Element;
        // if (value.length === 0) {
        //   const scrollTop = Math.floor(target.scrollTop * 0.9);
        //   const threshold = 1000;
        //   target.scrollTo({
        //     top: scrollTop > threshold ? scrollTop : threshold,
        //   });
        // }
      }
    );
  }
}
</script>

<style scoped lang="scss">
.container {
  height: calc(100vh - 129px);
  overflow: auto;
}
.container.small {
  height: calc(100vh - 113px);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s cubic-bezier(1, 0.5, 0.8, 1);
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
