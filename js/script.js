const { createApp } = Vue;
const apiURL = "./api.json";

const Modal = {
    template: `
        <Transition name="modal">
          <div v-if="show" class="modal-mask">
            <div class="modal-container">
              <div class="modal-body">
                <slot name="body">default body</slot>
              </div>
      
              <div class="modal-footer">
                <slot name="footer">
                  <button
                    class="modal-default-button"
                    @click="$emit('continue')"
                  >Працягнуць</button>
                  <button
                    class="modal-default-button white-button"
                    @click="$emit('restart')"
                  >Глядзець з пачатку</button>
                </slot>
              </div>
            </div>
          </div>
        </Transition>
    `,
    props: {
      show: Boolean
    }
};

var moviePlayer = createApp({
    components: {
        'modal' : Modal
    },
    data() {
        return {
            movieId: 0,
            videoData: {
                seasons: [{}]
            },
            activeSeason: 1,
            activeEpisode: 1,
            curVideo: {},
            playerInstance: null,
            lsName: 'userdata',
            showModal: false,
            storageTime: 0
        };
    },
    mounted() {
        this.movieId = document.getElementById("movieId").value;
        this.getAPIData();
        this.playerInstance = new Plyr(this.$refs.vplayer, {
            controls: [ "play-large", "play", "progress", "current-time", "mute", "volume", "captions", "airplay", "fullscreen" ],
            settings: ['captions', 'quality', 'speed', 'loop'],
            ratio: '16:9',
            fullscreen: { enabled: true, fallback: true, iosNative: true, container: null },
            keyboard: { focused: true, global: true }
        });

        if (as = this.localStorageWrapper('get','activeSeason')) {
            this.activeSeason = as;
        }
        if (ae = this.localStorageWrapper('get','activeEpisode')) {
            this.activeEpisode = ae;
        }

        this.playerInstance.on('ready',(event) => {
            var gl_curtime = this.localStorageWrapper('get','se' + this.activeSeason + '_ep' + this.activeEpisode + '_timestamp');
            if (gl_curtime && gl_curtime > 30) {
                // show modal with choise continue or restart
                this.showModal = true;
                this.storageTime = gl_curtime;
            } else {
                this.localStorageWrapper('set','se' + this.activeSeason + '_ep' + this.activeEpisode + '_timestamp',0);
            }
        });
        this.playerInstance.on('playing',(event) => {
            this.modalReset();
            this.localStorageWrapper('set','activeSeason',this.activeSeason);
            this.localStorageWrapper('set','activeEpisode',this.activeEpisode);
            this.playerInstance.elements.container.classList.remove('plyr--custom');

            this.playerInstance.on('ended', (event) => {
                this.localStorageWrapper('set','se' + this.activeSeason + '_ep' + this.activeEpisode + '_timestamp',0);
                vs = this.videoData.seasons.filter((t) => t.seasonNum == this.activeSeason).pop();

                if (this.playerInstance.source && this.activeEpisode < vs["episodes"].length) {
                    this.activeEpisode++;
                    this.reload();
                }
            });
        });
    },
    computed: {
        activeTabSeason() {
            if (!this.videoData.seasons[0].episodes)
                return { episodes: [ ] };
            return this.videoData.seasons
                .filter((t) => t.seasonNum == this.activeSeason)
                .pop();
        }
    },
    methods: {
        changeSeason(season, event) {
            this.modalReset();
            as = this.localStorageWrapper('get','activeSeason');
            ae = this.localStorageWrapper('get','activeEpisode')
            
            if ( as && ae && season.seasonNum == as) {
                // show episode to continue watched season
                this.activeSeason = season.seasonNum;
                this.activeEpisode = ae;
            } else {
                // else from season begin
                this.activeSeason = season.seasonNum;
                this.activeEpisode = 1;
            }
            this.reload();
        },
        changeEpisode(episode, event) {
            this.modalReset();
            this.activeEpisode = episode["episode"];
            this.reload();
        },
        formatSeconds: function(v) {
            var sec_num = parseInt(v, 10);
            var hours   = Math.floor(sec_num / 3600);
            var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
            var seconds = sec_num - (hours * 3600) - (minutes * 60);
        
            if (hours   < 10) {hours   = "0"+hours;}
            if (minutes < 10) {minutes = "0"+minutes;}
            if (seconds < 10) {seconds = "0"+seconds;}
            return hours + ':' + minutes + ':' + seconds;
        },
        movieContinue() {
            if (this.storageTime) {
                this.playerInstance.media.currentTime = this.storageTime;
                this.playerInstance.elements.container.classList.add('plyr--custom');
            }
            this.localStorageWrapper('set','se' + this.activeSeason + '_ep' + this.activeEpisode + '_timestamp',0);
            this.playerInstance.play();
        },
        movieRestart() {
            this.localStorageWrapper('set','se' + this.activeSeason + '_ep' + this.activeEpisode + '_timestamp',0);
            this.playerInstance.play();
        },
        modalReset() {
            this.storageTime = 0;
            this.showModal = false;
        },
        reload() {
            const vs = this.videoData.seasons.filter((t) => t.seasonNum == this.activeSeason).pop();
            this.curVideo = vs["episodes"].filter((t) => t.episode == this.activeEpisode).pop();
            this.playerInstance.source = {
                type: 'video',
                title: this.curVideo.name,
                sources: [{
                    src: this.curVideo.link,
                    type: 'video/mp4'
                }],
                poster: this.curVideo.img
            }

            this.playerInstance.on('timeupdate',(event) => {
                if (this.playerInstance.media.currentTime && this.playerInstance.media.currentTime > 0) {
                    //update only when < 95%
                    if (this.playerInstance.media.currentTime/this.playerInstance.media.duration > 0.95) {
                        this.localStorageWrapper('set','se' + this.activeSeason + '_ep' + this.activeEpisode + '_timestamp',0);
                    } else {
                        this.localStorageWrapper('set','se' + this.activeSeason + '_ep' + this.activeEpisode + '_timestamp',this.playerInstance.media.currentTime);
                    }
                }
            });
        },
        localStorageWrapper(method, name, value = '') {
            var lsHash = this.lsName + '_' + this.movieId;
            switch(method) {
                case 'get':
                    if (localStorage.getItem(lsHash)) {
                        try {
                            var ls = JSON.parse(localStorage.getItem(lsHash));
                        } catch(e) {
                            localStorage.removeItem(lsHash);
                        }
                        
                        if (ls) {
                            try {
                                return ls[name];
                            } catch (e) {
                                return false;
                            }
                        }
                    }
                    break;
                case 'set':
                    try {
                        var ls = JSON.parse(localStorage.getItem(lsHash));
                    } catch(e) {
                        localStorage.removeItem(lsHash);
                    }
                    
                    if (ls) {
                        ls[name] = value;;
                    } else {
                        ls = {};
                        ls[name] = value;
                    }
                    localStorage.setItem(lsHash,JSON.stringify(ls));
            }
        },
        async getAPIData() {
          if (this.movieId) {
            try {
              const res = await fetch(apiURL+'?movie_id='+this.movieId);
              if (!res.ok) {
                throw new Error(message);
              }
              const data = await res.json();
              this.videoData.seasons = data;
              this.reload();
            } catch (err) { }
          }
        }
    }
});

/* dark mode switcher */
var themeToggle = createApp({
    data() {
        return {
            theme: document.body.getAttribute('data-theme'),
            prefersDarkScheme: window.matchMedia("(prefers-color-scheme: dark)")
        }
    },
    methods: {
        toggleEv() {
            document.cookie = "theme=" + this.theme + "; path=/";
            document.body.setAttribute('data-theme', this.theme);
        },
        toggleTheme() {
            this.theme = this.theme === 'light' ? 'dark' : 'light';
            this.toggleEv();
        }
    },
    mounted() {
        if (document.cookie.indexOf("theme") != '-1') {
            this.theme = this.theme;
        } else if (this.prefersDarkScheme) {
            this.theme = 'dark';
            this.toggleEv();
        }
    }
});

themeToggle.mount('#theme');
moviePlayer.mount('#app');