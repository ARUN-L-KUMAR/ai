import { getPackages, getAccessToken } from '../api/tripxplo';

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Origin": "https://admin.tripxplo.com",
  "Referer": "https://admin.tripxplo.com/",
  "User-Agent": "Mozilla/5.0",
};

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const tools: Tool[] = [
  {
    name: "get_packages",
    description: "Get travel packages from TripXplo. Use this when users ask about packages, tours, or travel options.",
    parameters: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Search term for filtering packages"
        },
        days: {
          type: "number",
          description: "Number of days for the trip"
        }
      },
      required: []
    }
  },
  {
    name: "get_package_details",
    description: "Get detailed information about a specific package. Use when users ask for more details about a package ID.",
    parameters: {
      type: "object",
      properties: {
        packageId: {
          type: "string",
          description: "Package ID to get details for"
        }
      },
      required: ["packageId"]
    }
  },
  {
    name: "get_package_pricing",
    description: "Get detailed pricing for a package. Ask users for travel date, number of adults, children, and rooms.",
    parameters: {
      type: "object",
      properties: {
        packageId: {
          type: "string",
          description: "Package ID to get pricing for"
        },
        startDate: {
          type: "string",
          description: "Travel start date (YYYY-MM-DD format)"
        },
        noAdult: {
          type: "number",
          description: "Number of adults"
        },
        noChild: {
          type: "number",
          description: "Number of children"
        },
        noRoomCount: {
          type: "number",
          description: "Number of rooms"
        },
        noExtraAdult: {
          type: "number",
          description: "Number of extra adults"
        }
      },
      required: ["packageId", "startDate", "noAdult", "noChild", "noRoomCount"]
    }
  },
  {
    name: "get_interests",
    description: "Get available travel interests/categories like adventure, romantic, family, etc.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "search_destinations",
    description: "Search for travel destinations. Use when users ask about specific places or want destination suggestions.",
    parameters: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Destination name to search for"
        }
      },
      required: []
    }
  },
  {
    name: "get_available_hotels",
    description: "Get available hotels for a specific package. Use when users ask about hotel options.",
    parameters: {
      type: "object",
      properties: {
        packageId: {
          type: "string",
          description: "Package ID to get hotels for"
        }
      },
      required: ["packageId"]
    }
  },
  {
    name: "get_available_vehicles",
    description: "Get available vehicles/cabs for a specific package. Use when users ask about transportation options.",
    parameters: {
      type: "object",
      properties: {
        packageId: {
          type: "string",
          description: "Package ID to get vehicles for"
        }
      },
      required: ["packageId"]
    }
  },
  {
    name: "get_available_activities",
    description: "Get available activities for a specific package. Use when users ask about activities or things to do.",
    parameters: {
      type: "object",
      properties: {
        packageId: {
          type: "string",
          description: "Package ID to get activities for"
        }
      },
      required: ["packageId"]
    }
  }
];

async function getPackagePricing(packageId: string, params: any): Promise<any> {
  const token = await getAccessToken();
  const queryParams = new URLSearchParams({
    packageId,
    startDate: params.startDate,
    noAdult: params.noAdult.toString(),
    noChild: params.noChild.toString(),
    noRoomCount: params.noRoomCount.toString(),
    noExtraAdult: (params.noExtraAdult || 0).toString()
  });
  
  const response = await fetch(`https://api.tripxplo.com/v1/api/user/package/${packageId}/getOne?${queryParams}`, {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch package pricing: ${response.status}`);
  }

  return await response.json();
}

async function getInterests(): Promise<any[]> {
  const token = await getAccessToken();
  
  const response = await fetch('https://api.tripxplo.com/v1/api/admin/package/interest/get', {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch interests: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

async function searchDestinations(search?: string): Promise<any[]> {
  const token = await getAccessToken();
  const url = search 
    ? `https://api.tripxplo.com/v1/api/admin/package/destination/search?search=${encodeURIComponent(search)}`
    : 'https://api.tripxplo.com/v1/api/admin/package/destination/search';
  
  const response = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to search destinations: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

async function getAvailableHotels(packageId: string): Promise<any[]> {
  const token = await getAccessToken();
  
  const response = await fetch(`https://api.tripxplo.com/v1/api/admin/package/${packageId}/available/get`, {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch available hotels: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

async function getAvailableVehicles(packageId: string): Promise<any[]> {
  const token = await getAccessToken();
  
  const response = await fetch(`https://api.tripxplo.com/v1/api/admin/package/${packageId}/vehicle/get`, {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch available vehicles: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

async function getAvailableActivities(packageId: string): Promise<any[]> {
  const token = await getAccessToken();
  
  const response = await fetch(`https://api.tripxplo.com/v1/api/admin/package/${packageId}/activity/get`, {
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch available activities: ${response.status}`);
  }

  const data = await response.json();
  return data.result || [];
}

export async function executeTool(toolName: string, args: any): Promise<string> {
  switch (toolName) {
    case "get_available_hotels":
      try {
        const hotels = await getAvailableHotels(args.packageId);
        
        return JSON.stringify({
          packageId: args.packageId,
          hotels: hotels.map(hotel => ({
            id: hotel.id,
            name: hotel.hotelName,
            rating: hotel.rating,
            location: hotel.location,
            amenities: hotel.amenities
          }))
        });
      } catch (error) {
        return "Sorry, I couldn't fetch available hotels right now.";
      }
    
    case "get_available_vehicles":
      try {
        const vehicles = await getAvailableVehicles(args.packageId);
        
        return JSON.stringify({
          packageId: args.packageId,
          vehicles: vehicles.map(vehicle => ({
            id: vehicle.id,
            name: vehicle.vehicleName,
            type: vehicle.vehicleType,
            capacity: vehicle.capacity,
            features: vehicle.features
          }))
        });
      } catch (error) {
        return "Sorry, I couldn't fetch available vehicles right now.";
      }
    
    case "get_available_activities":
      try {
        const activities = await getAvailableActivities(args.packageId);
        
        return JSON.stringify({
          packageId: args.packageId,
          activities: activities.map(activity => ({
            id: activity.id,
            name: activity.activityName,
            description: activity.description,
            duration: activity.duration,
            location: activity.location
          }))
        });
      } catch (error) {
        return "Sorry, I couldn't fetch available activities right now.";
      }
    
    case "get_interests":
      try {
        const interests = await getInterests();
        
        return JSON.stringify({
          interests: interests.map(interest => ({
            id: interest.id,
            name: interest.interestName,
            description: interest.description
          }))
        });
      } catch (error) {
        return "Sorry, I couldn't fetch the travel interests right now.";
      }
    
    case "search_destinations":
      try {
        const destinations = await searchDestinations(args.search);
        
        return JSON.stringify({
          search: args.search,
          destinations: destinations.map(dest => ({
            id: dest.id,
            name: dest.destinationName,
            state: dest.state,
            country: dest.country
          }))
        });
      } catch (error) {
        return "Sorry, I couldn't search destinations right now.";
      }
    
    case "get_package_pricing":
      try {
        const pricingData = await getPackagePricing(args.packageId, args);
        
        return JSON.stringify({
          packageId: args.packageId,
          startDate: args.startDate,
          adults: args.noAdult,
          children: args.noChild,
          rooms: args.noRoomCount,
          extraAdults: args.noExtraAdult || 0,
          pricingDetails: pricingData
        });
      } catch (error) {
        return "Sorry, I couldn't fetch the package pricing right now. Please try again later.";
      }
    
    case "get_package_details":
      try {
        const packages = await getPackages();
        const pkg = packages.find(p => p.packageId === args.packageId);
        
        if (!pkg) {
          return `Package with ID "${args.packageId}" not found.`;
        }
        
        const dayByDay = pkg.activity?.map((day: any, index: number) => 
          `Day ${day.day}: ${day.from} to ${day.to}\n${day.event?.map((event: any) => `   - ${event.timePeriod}`).join('\n') || '   - Activities planned'}`
        ).join('\n\n') || 'Itinerary details not available';
        
        return `${pkg.packageName}\n\nDestination: ${pkg.destinationName || pkg.startFrom}\nDuration: ${pkg.noOfDays} days / ${pkg.noOfNight} nights\nStarting Price: ₹${pkg.startFrom}\nCapacity: ${pkg.noOfAdult} adults, ${pkg.noOfChild} children\nHotels: ${pkg.hotelCount} properties available\nActivities: ${pkg.activityCount} experiences included\n\nDay-by-Day Itinerary:\n${dayByDay}\n\nContact TripXplo for booking and pricing details.`;
      } catch (error) {
        return "Sorry, I couldn't fetch the package details right now.";
      }
    
    case "get_packages":
      try {
        console.log('📦 Fetching packages with search:', args.search);
        const packages = await getPackages(args.search);
        console.log('📊 Total packages fetched:', packages.length);
        
        if (packages.length === 0) {
          console.log('❌ No packages found');
          return "No packages found matching your criteria.";
        }

        // Filter by days and location
        let filteredPackages = packages;
        
        if (args.days) {
          filteredPackages = filteredPackages.filter(pkg => pkg.noOfDays === args.days);
          console.log(`📅 Filtered by ${args.days} days:`, filteredPackages.length);
        }
        
        if (args.search) {
          filteredPackages = filteredPackages.filter(pkg => 
            pkg.packageName?.toLowerCase().includes(args.search.toLowerCase()) ||
            pkg.description?.toLowerCase().includes(args.search.toLowerCase()) ||
            (pkg.destination && typeof pkg.destination === 'string' && pkg.destination.toLowerCase().includes(args.search.toLowerCase())) ||
            (pkg.destinationName && typeof pkg.destinationName === 'string' && pkg.destinationName.toLowerCase().includes(args.search.toLowerCase()))
          );
          console.log(`🔍 Filtered by search "${args.search}":`, filteredPackages.length);
        }

        if (filteredPackages.length === 0) {
          console.log('❌ No packages after filtering');
          return `No ${args.days ? args.days + '-day' : ''} packages found${args.search ? ` for "${args.search}"` : ''}. Try searching for other destinations.`;
        }

        const result = JSON.stringify({
          packages: filteredPackages.slice(0, 10).map(pkg => ({
            name: pkg.packageName,
            destination: pkg.destinationName || pkg.startFrom,
            days: pkg.noOfDays,
            nights: pkg.noOfNight,
            startFrom: pkg.startFrom,
            hotels: pkg.hotelCount || 0,
            activities: pkg.activityCount || 0,
            packageId: pkg.packageId
          })),
          search: args.search,
          days: args.days
        });
        console.log('✅ Successfully returning', filteredPackages.length, 'packages');
        return result;
      } catch (error) {
        console.error('💥 get_packages error:', error);
        return "Sorry, I couldn't fetch the packages right now. Please try again later.";
      }
    
    default:
      return `Unknown tool: ${toolName}`;
  }
}