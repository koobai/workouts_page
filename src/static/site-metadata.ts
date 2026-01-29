interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  keywords: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const data: ISiteMetadataResult = {
  siteTitle: '骑行 - 空白Koobai',
  siteUrl: 'https://sport.koobai.com',
  logo: 'https://img.koobai.com/koobai.webp',
  description: '越来越肥胖的身体，导致双脚都扛不住了，没走几下就累；体检数据也一年比一年难看，是时候该动起来了。',
  keywords: 'workouts, running, cycling, riding, roadtrip, hiking, swimming',
  navLinks: [
    {
      name: '唠叨',
      url: 'https://koobai.com',
      icon: 'home'
    },
    {
      name: '博文',
      url: 'https://koobai.com/posts/',
      icon: 'bowen'
    },
    {
      name: '观影',
      url: 'https://koobai.com/movies/',
      icon: 'guany'
    },
    {
      name: '软件',
      url: 'https://koobai.com/apps/',
      icon: 'ruanj'
    },
    {
      name: '骑行',
      url: '/',
      icon: 'qixing'
    },
    {
      name: '店铺',
      url: 'https://qiszy.taobao.com',
      target: '_blank',
      icon: 'haowu'
    },
  ],
};

export default data;
