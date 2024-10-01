import React, { useEffect, useState } from "react";
import axios from "axios";

export default function PostChannels() {
    const [token, setToken] = useState('');
    const [channelId, setChannelId] = useState('');

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
                const statsUrl = `${process.env.REACT_APP_STRAPI_API_URL}/channel-statistics?filters[channel_id][$eq]=${item.id}&filters[cDateTime][$eq]=${today}`;

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
                                cDateTime: new Date().toISOString()
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
        </div>
    );
}