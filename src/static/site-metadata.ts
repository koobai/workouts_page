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
      name: '首页',
      url: 'https://koobai.com',
    },
    {
      name: '博文',
      url: 'https://koobai.com/posts/',
    },
    {
      name: '骑行',
      url: '/',
    },
    {
      name: '软件',
      url: 'https://koobai.com/apps/',
    },
    {
      name: '观影',
      url: 'https://koobai.com/movies/',
    },
    {
      name: '好物',
      url: 'https://qiszy.taobao.com',
      target: '_blank',
    },
  ],
};

export default data;
