import React, { useState } from "react";
import axios from "axios";
import {
  TextField,
  Button,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  TablePagination,
} from "@mui/material";
import * as XLSX from 'xlsx';
// Fonksiyonlar: ISO 8601 formatındaki süreyi saniyeye dönüştürme ve süreyi formatlama
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

const App = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [videoData, setVideoData] = useState([]);
  const [channelData, setChannelData] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchVideos = async () => {
    try {
      // Kanal araması
      const channelResponse = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            q: searchTerm,
            type: "channel",
            maxResults: 1, // İlk bulunan kanalı almak yeterli
            key: process.env.REACT_APP_YOUTUBE_API_KEY,
          },
        }
      );

      const channelId = channelResponse.data.items[0]?.id?.channelId;

      if (channelId) {
        // Kanal detaylarını alma
        const channelDetailsResponse = await axios.get(
          "https://www.googleapis.com/youtube/v3/channels",
          {
            params: {
              part: "snippet,statistics",
              id: channelId,
              key: process.env.REACT_APP_YOUTUBE_API_KEY,
            },
          }
        );

        // Kanal bilgilerini güncelleme
        setChannelData(channelDetailsResponse.data.items[0]);

        // Videoları alma
        const videosResponse = await axios.get(
          "https://www.googleapis.com/youtube/v3/search",
          {
            params: {
              part: "snippet",
              channelId: channelId,
              order: "date",
              maxResults: 30,
              key: process.env.REACT_APP_YOUTUBE_API_KEY,
            },
          }
        );

        const videoIds = videosResponse.data.items
          .map((item) => item.id.videoId)
          .join(",");

        if (videoIds) {
          const videoDetails = await axios.get(
            "https://www.googleapis.com/youtube/v3/videos",
            {
              params: {
                part: "snippet,contentDetails,statistics",
                id: videoIds,
                key: process.env.REACT_APP_YOUTUBE_API_KEY,
              },
            }
          );

          // Videoları yayınlandığı tarihe göre sıralama
          const sortedVideos = videoDetails.data.items.sort((a, b) => {
            const dateA = new Date(a.snippet.publishedAt);
            const dateB = new Date(b.snippet.publishedAt);
            return dateB - dateA; // En yeni videolar önce gelir
          });

          setVideoData(sortedVideos);
        }
      }
    } catch (error) {
      console.error("Error fetching data from YouTube API:", error);
    }
  };
/* tek bir video  */
  const saveVideoToStrapi = async (video) => {
    const durationInSeconds = parseDuration(
      video?.contentDetails?.duration || ""
    );
    try {
      await axios.post("http://localhost:1337/api/video-infos", {
        data: {
          videoId: video?.id,
          title: video?.snippet?.title,
          channelId: video?.snippet?.channelTitle,
          viewCount: video?.statistics?.viewCount,
          uploadDate: video?.snippet?.publishedAt,
          likeCount: video?.statistics?.likeCount,
          commentCount: video?.statistics?.commentCount,
          duration: durationInSeconds,
          subscriberCount: channelData?.statistics?.subscriberCount,
          videoCount: channelData?.statistics?.videoCount,
          totalViewCount: channelData?.statistics?.viewCount,
          joinedAt: channelData?.snippet?.publishedAt,
        },
        headers: {
          "Content-Type": "application/json",
        },
      });
      alert("Video başarıyla kaydedildi!");
    } catch (error) {
      console.error("Error saving video to Strapi:", error);
    }
  };

  const saveAllVideosToStrapi = async () => {
    try {
      await Promise.all(
        videoData.map((video) => {
          const durationInSeconds = parseDuration(
            video?.contentDetails?.duration || ""
          );
          return axios.post("http://localhost:1337/api/video-infos", {
            data: {
              videoId: video?.id,
              title: video?.snippet?.title,
              channelId: video?.snippet?.channelTitle,
              viewCount: video?.statistics?.viewCount,
              uploadDate: video?.snippet?.publishedAt,
              likeCount: video?.statistics?.likeCount,
              commentCount: video?.statistics?.commentCount,
              duration: durationInSeconds,
              subscriberCount: channelData?.statistics?.subscriberCount,
              videoCount: channelData?.statistics?.videoCount,
              totalViewCount: channelData?.statistics?.viewCount,
              joinedAt: channelData?.snippet?.publishedAt,
            },
            headers: {
              "Content-Type": "application/json",
            },
          });
        })
      );
      alert("Tüm videolar başarıyla kaydedildi!");
      exportToExcel();
    } catch (error) {
      console.error("Error saving videos to Strapi:", error);
    }
  };

  const fetchVideoData = async () => {
    try {
      let allData = [];
      let page = 1;
      const pageSize = 100; // Her sayfada çekilecek veri sayısı
      let hasMoreData = true;
  
      while (hasMoreData) {
        const response = await axios.get("http://localhost:1337/api/video-infos", {
          params: {
            "pagination[page]": page,
            "pagination[pageSize]": pageSize,
          },
        });
  
        const fetchedData = response.data.data;
        allData = [...allData, ...fetchedData]; // Gelen veriyi tüm verilerinize ekleyin
  
        // Eğer çekilen veri sayısı pageSize'dan küçükse, daha fazla veri yoktur.
        if (fetchedData.length < pageSize) {
          hasMoreData = false;
        }
  
        page++; // Bir sonraki sayfayı getir
      }
  
      console.log("Tüm veri çekildi:", allData);
      return allData;
  
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    }
  };
  
  
  const exportToExcel = async () => {
    try {
      // Video verilerini çek
      const videoData = await fetchVideoData();
  
      // Gelen verileri kontrol edin
      if (!videoData || !Array.isArray(videoData)) {
        console.log("Fetched video data:", videoData);
        return;
      }
      
      // Sadece attributes verisini ayıklayın
      const videoArray = videoData.map(item => item.attributes);
      console.log("Video Array:", videoArray);
      
      // JSON verisini worksheet'e dönüştürün
      const worksheet = XLSX.utils.json_to_sheet(videoArray);
      
      // Yeni bir Excel workbook (çalışma kitabı) oluşturun
      const workbook = XLSX.utils.book_new();
      
      // Worksheet'i workbook'a ekleyin
      XLSX.utils.book_append_sheet(workbook, worksheet, "Videos");
      
      // Excel dosyasını kaydedin
      XLSX.writeFile(workbook, "videos_data.xlsx");
      
      console.log("Veriler başarıyla Excel dosyasına aktarıldı.");
  
    } catch (error) {
      console.error("Excel'e aktarma hatası:", error);
    }
  };
  
  

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  return (
    <Container maxWidth="xl">
      <Typography variant="h4" gutterBottom textAlign="center" my={3}>
        YouTube Video ve Kanal Arama
      </Typography>
      <TextField
        label="Arama Terimi"
        variant="outlined"
        fullWidth
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        margin="normal"
      />
      <Button
        variant="contained"
        color="primary"
        onClick={fetchVideos}
        fullWidth
      >
        Ara
      </Button>
      <Button
        variant="contained"
        color="secondary"
        onClick={() => saveAllVideosToStrapi()}
        fullWidth
        style={{ marginTop: 20 }}
      >
        Videoları Strapiye Kaydet
      </Button>
      <Button
        variant="contained"
        color="success"
        onClick={exportToExcel}
        fullWidth
        sx={{ mt: 2 }}
      >
        Excel'e Aktar
      </Button>
      <TableContainer component={Paper} style={{ marginTop: 20 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell align="center" colSpan={2}>
                Video Bilgileri
              </TableCell>
              <TableCell align="center" colSpan={4}>
                İstatistikler
              </TableCell>
              <TableCell align="center" colSpan={4}>
                Kanal Bilgileri
              </TableCell>
              <TableCell align="center" colSpan={2}>
                İşlemler
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>VİDEO BAŞLIĞI</TableCell>
              <TableCell>KANAL ADI</TableCell>
              <TableCell>GÖRÜNTÜLENME SAYISI</TableCell>
              <TableCell>BEĞENİ SAYISI</TableCell>
              <TableCell>YORUM SAYISI</TableCell>
              <TableCell>VİDEO SÜRESİ</TableCell>
              <TableCell>YAYINLANDIĞI TARİH</TableCell>
              <TableCell>KANALIN ABONE SAYISI</TableCell>
              <TableCell>KANALDAKİ TOPLAM VIDEO SAYISI</TableCell>
              <TableCell>KANALIN TOPLAM GÖRÜNTÜLENME SAYISI</TableCell>
              <TableCell>KANALIN KATILMA TARİHİ</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {videoData
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((video) => {
                const durationInSeconds = parseDuration(
                  video?.contentDetails?.duration || ""
                );
                const formattedDuration = formatDuration(durationInSeconds);
                return (
                  <TableRow key={video.id}>
                    <TableCell>{video?.snippet?.title || ""}</TableCell>
                    <TableCell>{video?.snippet?.channelTitle || ""}</TableCell>
                    <TableCell>
                      {video?.statistics?.viewCount
                        ? video.statistics.viewCount.toLocaleString("tr-TR")
                        : ""}
                    </TableCell>
                    <TableCell>
                      {video?.statistics?.likeCount
                        ? video.statistics.likeCount.toLocaleString("tr-TR")
                        : ""}
                    </TableCell>
                    <TableCell>
                      {video?.statistics?.commentCount
                        ? video.statistics.commentCount.toLocaleString("tr-TR")
                        : "0"}
                    </TableCell>
                    <TableCell>{formattedDuration || ""}</TableCell>
                    <TableCell>
                      {video?.snippet?.publishedAt
                        ? new Date(
                            video.snippet.publishedAt
                          ).toLocaleDateString()
                        : ""}
                    </TableCell>
                    <TableCell>
                      {channelData?.statistics?.subscriberCount
                        ? channelData.statistics.subscriberCount.toLocaleString(
                            "tr-TR"
                          )
                        : ""}
                    </TableCell>
                    <TableCell>
                      {channelData?.statistics?.videoCount
                        ? channelData.statistics.videoCount.toLocaleString(
                            "tr-TR"
                          )
                        : ""}
                    </TableCell>
                    <TableCell>
                      {channelData?.statistics?.viewCount
                        ? channelData.statistics.viewCount.toLocaleString(
                            "tr-TR"
                          )
                        : ""}
                    </TableCell>
                    <TableCell>
                      {channelData?.snippet?.publishedAt
                        ? new Date(
                            channelData.snippet.publishedAt
                          ).toLocaleDateString()
                        : ""}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => saveVideoToStrapi(video)}
                      >
                        Kaydet
                      </Button>
                    </TableCell>
                  </TableRow>
                  
                );
              })}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 20, 30]}
          component="div"
          count={videoData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
{/*       <DataFetchComponent/>
 */}    </Container>
  );
};

export default App;
