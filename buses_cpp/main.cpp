#include <boost/algorithm/string.hpp>
#include <filesystem>
#include <fstream>
#include <thread>
#include "functions.h"

namespace fs = std::filesystem;

int main(int, char *argv[])
{
        std::string boro(argv[1]);

        std::ifstream file;
        file.open("list_of_bus_routes.txt");
        std::string s;
        file >> s;
        std::vector<std::string> routes;
        boost::split(routes, s, boost::is_any_of(","));

        SharedQueue<std::string> queue;

        std::vector<std::thread> threads;
        threads.push_back(std::thread(db_connection, std::ref(queue)));

        for (auto &route : routes)
        {
                if (route.rfind(argv[1], 0) == 0 && route[1] != 'X')
                        threads.push_back(std::thread(track, route, boro, std::ref(queue)));

                else if (boro == "BX" && route[1] == 'X')
                        threads.push_back(std::thread(track, route, boro, std::ref(queue)));
        }

        
        for (auto &t : threads)
                t.join();
}
