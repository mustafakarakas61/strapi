import React, { useEffect, useState } from "react";
import axios from "axios";

export default function PostChannels() {
    const [token, setToken] = useState('');
    const [channelId, setChannelId] = useState('');

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
            const findAllUrl = `${process.env.REACT_APP_STRAPI_API_URL}/channel-ids?filters[channelId][$ne]=&filters[title][$null]=true&filters[channelPublishedAt][$null]=true&filters[dataStatus]=true&pagination[pageSize]=100`;

            try {
                const findAllResponse = await axios.get(findAllUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const items = findAllResponse.data.data;

                for (const item of items) {
                    try {

                        const channelId = item.channelId;
                        const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
                        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`;

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
                    } catch (error) {
                        console.log("error", error)
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

        button.addEventListener('click', handleButtonClick);
        updateButton.addEventListener('click', handleUpdateButtonClick);
        updateAllButton.addEventListener('click', handleUpdateAllButtonClick);

        return () => {
            button.removeEventListener('click', handleButtonClick);
            updateButton.removeEventListener('click', handleUpdateButtonClick);
            updateAllButton.removeEventListener('click', handleUpdateAllButtonClick);
        };
    }, [token, channelId]);

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
            <br />
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
        </div>
    );
}