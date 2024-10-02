import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

function parseDuration(duration) {
    const regex =/P(?:([0-9]+)Y)?(?:([0-9]+)M)?(?:([0-9]+)D)?T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/;
    const matches = duration.match(regex);
    // Eğer eşleşme yoksa, 0 döndür
    if (!matches) {
        console.error('Geçersiz süre formatı:', duration);
        return 0;
    }
    const years = parseInt(matches[1] || 0, 10);
    const months = parseInt(matches[2] || 0, 10);
    const days = parseInt(matches[3] || 0, 10);
    const hours = parseInt(matches[4] || 0, 10);
    const minutes = parseInt(matches[5] || 0, 10);
    const seconds = parseInt(matches[6] || 0, 10);
    return (
        seconds +
        minutes * 60 +
        hours * 3600 +
        days * 86400 +
        months * 2592000 +
        years * 31536000
    );
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}saat ` : ""}${m > 0 ? `${m}dakika ` : ""}${
        s > 0 ? `${s}saniye` : ""
    }`;
}

export default function PostChannels() {
    const [token, setToken] = useState('');
    const [channelId, setChannelId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchAllData = async (url, isChannel) => {
        let allData = [];
        let page = 1;
        const pageSize = 100;
        let tempUrl = url;
        while (true) {
            url = tempUrl;

            url = `${url}pagination[page]=${page}&pagination[pageSize]=${pageSize}&filters[dataStatus]=true&[populate]=*`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            allData = allData.concat(data.data);

            // Eğer daha fazla veri yoksa döngüden çık
            if (page >= data.meta.pagination.pageCount) {
                break;
            }
            page++;
        }

        return allData;
    };

    const transformDataToExcelFormat = (data) => {
        if (!data || data.length === 0) {
            console.error("Veri boş veya hatalı formatta!");
            return [];
        }
        return data.flatMap(video => {
            let channelName = video.title;
            let channelDescription = video.description;
            let channel_url = video.channelId;
            let subscriber_count = video.channel_statistics?.[0]?.subscriberCount || null;
            let total_video_count = video.channel_statistics?.[0]?.videoCount || null;
            let total_view_count = video.channel_statistics?.[0]?.viewCount || null;
            let channel_join_datetime = video.channelPublishedAt;
            let country = video.country;

            if (!video.channel_videos || video.channel_videos.length === 0) {
                return []; // Eğer video yoksa boş array döndür
            }

            return video.channel_videos.map(publishedVideo => ({
                "video_name": publishedVideo.title,
                "video_description": publishedVideo.description,
                "video_url": `https://youtube.com/watch?v=${publishedVideo.videoId}`,
                "video_publish_datetime": publishedVideo.videoPublishedAt,
                "video_view_count": publishedVideo.viewCount,
                "video_like_count": publishedVideo.likeCount,
                "video_comment_count": publishedVideo.commentCount,
                "video_duration": publishedVideo.duration,
                "video_tags": publishedVideo.tags,
                "channel_name": channelName,
                "channel_description": channelDescription,
                "channel_url": `https://www.youtube.com/channel/${channel_url}`,
                "channel_country": country,
                "subscriber_count": subscriber_count,
                "total_video_count": total_video_count,
                "total_view_count": total_view_count,
                "channel_join_datetime": channel_join_datetime,
                "report_date": new Date().toISOString().split('T')[0]
            }));
        });
    };



    const exportToExcel = (data) => {
        console.log(data.length);
        console.log(data[0])
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Veriler");
        XLSX.writeFile(workbook, "veriler.xlsx");
    };

    const fetchDataAndExport = async () => {
        const data = await fetchAllData('http://localhost:1337/api/channel-ids?', true);

        /*channels.map(async channel => {

            console.log("channel", channel)

        });*/


        const formattedData = transformDataToExcelFormat(data);
        console.log(formattedData)
        exportToExcel(formattedData);
    };

    const handleFetchVideos = async () => {
        const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&publishedAfter=${new Date(startDate).toISOString()}&publishedBefore=${new Date(endDate).toISOString()}&key=${apiKey}&maxResults=1000`;

        try {
            const response = await axios.get(url);
            let videoIds = [];

            if (response.data.items && response.data.items.length > 0) {
                let items = response.data.items;
                if (response.data.pageInfo.totalResults >=100) {
                    console.error("items count is greater than 100: " + response.data.pageInfo.totalResults);
                } else {
                    console.log("items count: " + response.data.pageInfo.totalResults);
                }
                for (let i = 0; i < items.length; i++) {
                    if (items[i].id && items[i].id.videoId) {
                        videoIds.push(items[i].id.videoId);
                    }
                }

            }

            if (videoIds.length > 0) {
                const videoIdsJoined = videoIds.join(',');
                const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIdsJoined}&key=${apiKey}`;
                const response = await axios.get(url);
// TODO: videoId ve cDate kontrolü sağlanılarak var olup olmadığı kontro ledeilecek. yoksa eklenecek
                if (response.data.items && response.data.items.length > 0) {
                    let items = response.data.items;
                    for (let i = 0; i < items.length; i++) {
                        const findDocUrl =`${process.env.REACT_APP_STRAPI_API_URL}/channel-ids?filters[channelId][$eqi]=${items[i].snippet.channelId}`
                        const responseDocUrl = await axios.get(findDocUrl)

                        if (responseDocUrl.data.data.length > 0) {
                            const docId = responseDocUrl.data.data[0].documentId

                            const newVideos = {
                                data: {
                                    videoId : items[i].id,
                                    channel_id : docId,
                                    videoPublishedAt : items[i].snippet.publishedAt,
                                    title : items[i].snippet.title,
                                    description : items[i].snippet.description,
                                    thumbnails : items[i].snippet.thumbnails,
                                    tags: items[i].snippet.tags ? items[i].snippet.tags.join(',') : '',
                                    categoryId : items[i].snippet.categoryId,
                                    duration : parseDuration(items[i].contentDetails.duration),
                                    viewCount : items[i].statistics.viewCount,
                                    likeCount : items[i].statistics.likeCount,
                                    commentCount : items[i].statistics.commentCount,
                                    cDate : new Date().toISOString()
                                }
                            };

                            await axios.post(`${process.env.REACT_APP_STRAPI_API_URL}/channel-videos`, newVideos, {
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            console.log(`Viedo bilgisi başarıyla eklendi: ${items[i].id}`);
                        } else {
                            console.error("Dokuman bilgisi alınamadı")
                        }

                    }

                }
            }
        } catch (error) {
            console.error(`Hata: ${error.response ? error.response.data : error.message}`);
        }
    };

    const handleStatisticsUpdate = async () => {
        const today = new Date().toISOString().split('T')[0];

        const findAllUrl = `${process.env.REACT_APP_STRAPI_API_URL}/channel-ids?sort[1]=title:asc&filters[dataStatus]=true`;

        try {
            let allItems = [];
            let total = 0;
            let pageCount;
            let page = 1;
            const pageSize = 100;

            const totalResponse = await axios.get(`${findAllUrl}&pagination[pageSize]=${pageSize}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            // total = totalResponse.data.meta.pagination.total;
            pageCount = totalResponse.data.meta.pagination.pageCount;

            while (page <= pageCount) {
                const response = await axios.get(`${findAllUrl}&pagination[pageSize]=${pageSize}&pagination[page]=${page}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                allItems = allItems.concat(response.data.data);
                page = page + 1;
            }

            for (const item of allItems) {
                const channelId = item.channelId;
                const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
                const statsUrl = `${process.env.REACT_APP_STRAPI_API_URL}/channel-statistics?filters[channel_id][$eq]=${item.id}&filters[cDate][$eq]=${today}`;

                const existingStatsResponse = await axios.get(statsUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (existingStatsResponse.data.data.length === 0) {
                    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
                    const response = await axios.get(url);
                    const stats = response.data.items[0]?.statistics;

                    if (stats) {
                        const newStatistics = {
                            data: {
                                channel_id: item.documentId,
                                viewCount: stats.viewCount,
                                subscriberCount: stats.subscriberCount,
                                hiddenSubscriberCount: stats.hiddenSubscriberCount,
                                videoCount: stats.videoCount,
                                cDate: new Date().toISOString()
                            }
                        };

                        await axios.post(`${process.env.REACT_APP_STRAPI_API_URL}/channel-statistics`, newStatistics, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        console.log(`Yeni istatistikler başarıyla eklendi: ${channelId}`);
                    } else {
                        console.log(`İstatistikler bulunamadı: ${channelId}`);
                    }
                } else {
                    console.log(`Bu yayın için bugüne ait istatistik zaten mevcut: ${channelId}`);
                }
            }
            alert('İstatistik güncellemeleri tamamlandı.');
        } catch (error) {
            console.error(`Hata: ${error.response ? error.response.data : error.message}`);
        }
    };

    useEffect(() => {
        const handleButtonClick = async () => {
            const input = document.getElementById('dataInput').value;
            let jsonData;

            try {
                jsonData = JSON.parse(input);
            } catch (error) {
                alert('Lütfen geçerli bir JSON formatı girin.');
                return;
            }

            const url = 'http://localhost:1337/api/channel-ids';

            for (const item of jsonData) {
                try {
                    const response = await axios.post(url, {
                        data: {
                            mtmId: item.mtmId,
                            dataStatus: item.dataStatus,
                            channelId: item.channelId
                        }
                    }, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log(`Başarılı: ${response.data}`);
                } catch (error) {
                    console.error(`Hata: ${error.response ? error.response.data : error.message}`);
                }
            }
        };

        const handleUpdateButtonClick = async () => {
            if (!channelId) {
                alert('Lütfen bir Channel ID girin.');
                return;
            }

            const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
            const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`;

            try {
                const response = await axios.get(url);
                const data = response.data.items[0];

                if (data) {
                    const updatedData = {
                        data: {
                            title: data.snippet.title,
                            description: data.snippet.description,
                            channelPublishedAt: data.snippet.publishedAt,
                            thumbnails: data.snippet.thumbnails,
                            country: data.snippet.country,
                        },
                    };

                    const findIdUrl = `${process.env.REACT_APP_STRAPI_API_URL}/channel-ids?filters[channelId][$eqi]=${channelId}`;

                    const findIdResponse = await axios.get(findIdUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    const findIdData = findIdResponse.data;

                    if (findIdData && findIdData.data.length > 0) {
                        let foundDocumentId = findIdData.data[0].documentId;

                        const updateUrl = `${process.env.REACT_APP_STRAPI_API_URL}/channel-ids/${foundDocumentId}`;
                        await fetch(updateUrl, {
                            method: "PUT",
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(updatedData),
                        });
                        alert('Kanal güncelleme işlemi tamamlandı');
                    } else {
                        alert('Kanal bilgilerinde id değeri alınamadı.');
                    }
                } else {
                    alert('Kanal bilgileri bulunamadı.');
                }
            } catch (error) {
                console.error(`Hata: ${error.response ? error.response.data : error.message}`);
            }
        };

        const handleUpdateAllButtonClick = async () => {
            let pageSize = 100;
            const findAllUrl = `${process.env.REACT_APP_STRAPI_API_URL}/channel-ids?sort[1]=title:asc&filters[dataStatus]=true&filters[channelId][$ne]=&filters[title][$null]=true&filters[channelPublishedAt][$null]=true&filters[dataStatus]=true&pagination[pageSize]=${pageSize}`;
            let allItems = [];
            let page = 1;
            let totalPages = 1;

            try {
                do {
                    const response = await axios.get(`${findAllUrl}&pagination[page]=${page}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    const items = response.data.data || [];
                    allItems = allItems.concat(items);

                    totalPages = response.data.meta.pagination.totalPages || 1;
                    page++;
                } while (page <= totalPages);

                const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;

                for (let i = 0; i < allItems.length; i += pageSize) {
                    const ids = allItems.slice(i, i + pageSize).map(item => item.channelId).join(',');
                    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${ids}&key=${apiKey}`;

                    try {
                        const response = await axios.get(url);
                        const channelData = response.data.items;

                        for (const item of allItems.slice(i, i + pageSize)) {
                            const data = channelData.find(channel => channel.id === item.channelId);
                            if (data) {
                                const updatedData = {
                                    data: {
                                        title: data.snippet.title,
                                        description: data.snippet.description,
                                        channelPublishedAt: data.snippet.publishedAt,
                                        thumbnails: data.snippet.thumbnails,
                                        country: data.snippet.country,
                                    },
                                };

                                const updateUrl = `${process.env.REACT_APP_STRAPI_API_URL}/channel-ids/${item.documentId}`;
                                await fetch(updateUrl, {
                                    method: "PUT",
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(updatedData),
                                });
                            }
                        }
                    } catch (error) {
                        console.log("error", error);
                    }
                }
                alert('Tüm yayınlar güncellendi.');
            } catch (error) {
                console.error(`Hata: ${error.response ? error.response.data : error.message}`);
            }
        };

        const button = document.getElementById('submitButton');
        const updateButton = document.getElementById('updateButton');
        const updateAllButton = document.getElementById('updateAllButton');

        const statsUpdateButton = document.getElementById('statsUpdateButton');
        statsUpdateButton.addEventListener('click', handleStatisticsUpdate);

        button.addEventListener('click', handleButtonClick);
        updateButton.addEventListener('click', handleUpdateButtonClick);
        updateAllButton.addEventListener('click', handleUpdateAllButtonClick);

        return () => {
            button.removeEventListener('click', handleButtonClick);
            updateButton.removeEventListener('click', handleUpdateButtonClick);
            updateAllButton.removeEventListener('click', handleUpdateAllButtonClick);
            statsUpdateButton.removeEventListener('click', handleStatisticsUpdate);
        };
    }, [token]);

    return (
        <div>
            <h1>Strapi'ye Veri Gönder</h1>
            <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Bearer Token'i buraya girin"
            />
            <h2>Strapi'ye Kanal Ekle</h2>
            <textarea
                id="dataInput"
                rows="10"
                cols="50"
                placeholder='[{"mtmId": 1367, "dataStatus": 1, "channelId": "UCkFVj7d9rRFuGANSNCaTsfg"}]'
            />
            <br/>
            <button id="submitButton">Ekle</button>

            <h2>Kanal Bilgilerini Güncelle</h2>
            <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="Channel ID'yi buraya girin"
            />
            <button id="updateButton">Güncelle</button>

            <h2>Verisi olmayan Tüm Yayınları Güncelle</h2>
            <button id="updateAllButton">Güncelle</button>
            <h2>İstatistikleri Güncelle</h2>
            <button id="statsUpdateButton">Güncelle</button>

            <h2>YouTube Videolarını Getir</h2>
            <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="Channel ID'yi buraya girin"
            />
            <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
            />
            <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
            />
            <br/>
            <button onClick={handleFetchVideos}>Videoları Getir</button>
            <br/>
            <div>
                <button onClick={fetchDataAndExport}>Excel'e Aktar</button>
            </div>
        </div>
    );
}