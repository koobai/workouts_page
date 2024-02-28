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
  siteTitle: '锻炼 - 空白Koobai',
  siteUrl: 'https://sport.koobai.com',
  logo: 'https://img.koobai.com/koobai.webp',
  description: 'Personal site and blog',
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
      name: '锻炼',
      url: '/',
    },
    {
      name: '软件',
      url: 'https://koobai.com/apps/',
    },
    {
      name: '好物',
      url: 'https://koobai.com/hardware/',
    },
    {
      name: '观影',
      url: 'https://koobai.com/movies/',
    },
  ],
};

export default data;
